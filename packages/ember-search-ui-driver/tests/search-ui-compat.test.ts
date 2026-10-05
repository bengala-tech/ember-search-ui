import { afterEach, describe, expect, test } from 'vitest';
import {
  OperatorRegistry,
  SearchDriver,
  eq,
  fromSearchUiState,
  memoryBackend,
  nodeToFilter,
  not,
  or,
  searchApiCodec,
  searchUiCompat,
  sequentialIds,
  type SearchUiState,
} from '../src/index.ts';

interface Doc {
  id: number;
  state: string;
  cost?: number;
  tags: string[];
}

const DOCS: Doc[] = [
  { id: 1, state: 'created', cost: 10, tags: ['a'] },
  { id: 2, state: 'pending', cost: 200, tags: ['a', 'b'] },
  { id: 3, state: 'done', tags: [] },
  { id: 4, state: 'created', cost: 5000, tags: ['b'] },
  { id: 5, state: 'done', cost: 50, tags: ['c'] },
];

const compats: { tearDown(): void }[] = [];
afterEach(() => compats.splice(0).forEach((c) => c.tearDown()));

function setup(initialState = {}) {
  const driver = new SearchDriver<Doc>({
    backend: memoryBackend(DOCS),
    idFactory: sequentialIds(),
    initialState: {
      page: { kind: 'offset', page: 1, perPage: 2 },
      ...initialState,
    },
  });
  const compat = searchUiCompat(driver);
  compats.push(compat);
  return { driver, compat };
}

const ids = (state: SearchUiState) => (state.results as Doc[]).map((d) => d.id);

describe('searchUiCompat: the search-ui driver API over the new driver', () => {
  test('getState has the search-ui shape', async () => {
    const { driver, compat } = setup();
    await driver.settled();
    expect(compat.getState()).toMatchObject({
      current: 1,
      resultsPerPage: 2,
      searchTerm: '',
      sortField: '',
      sortDirection: '',
      filters: [],
      totalResults: 5,
      totalPages: 3,
      pagingStart: 1,
      pagingEnd: 2,
      wasSearched: true,
      isLoading: false,
      error: '',
    });
    expect(ids(compat.state)).toEqual([1, 2]);
    expect(compat.getState()).toBe(compat.getState()); // stable until something changes
  });

  test('actions work as in search-ui (setFilter with type "any")', async () => {
    const { driver, compat } = setup({
      page: { kind: 'offset', page: 1, perPage: 20 },
    });
    const { actions } = compat;

    actions.setFilter('state', ['created', 'pending'], 'any');
    await driver.settled();
    expect(compat.state.filters).toEqual([
      { field: 'state', values: ['created', 'pending'], type: 'any' },
    ]);
    expect(ids(compat.state)).toEqual([1, 2, 4]);

    actions.setFilter('cost', { gte: 100 }, 'any');
    await driver.settled();
    expect(ids(compat.state)).toEqual([2, 4]);

    actions.removeFilter('state', 'pending');
    await driver.settled();
    expect(compat.state.filters[0]).toEqual({
      field: 'state',
      values: ['created'],
      type: 'any',
    });
    expect(ids(compat.state)).toEqual([4]);

    actions.addFilter('state', 'pending', 'any');
    await driver.settled();
    expect(compat.state.filters[0]?.values).toEqual(['created', 'pending']);

    actions.setFilter('cost', null); // blank removes (a common search-ui driver override)
    actions.clearFilters(['state']);
    await driver.settled();
    expect(compat.state.filters.map((f) => f.field)).toEqual(['state']);

    actions.clearFilters();
    actions.setSort('cost', 'desc');
    actions.setCurrent(1);
    await driver.settled();
    expect(compat.state).toMatchObject({
      sortField: 'cost',
      sortDirection: 'desc',
      filters: [],
    });
    expect(ids(compat.state)).toEqual([4, 2, 5, 1, 3]);
  });

  test('type "none" negates; exists filters; setSearchTerm clears filters like search-ui', async () => {
    const { driver, compat } = setup({
      page: { kind: 'offset', page: 1, perPage: 20 },
    });
    compat.actions.setFilter('state', 'done', 'none');
    compat.actions.setFilter('cost', { exists: true });
    await driver.settled();
    expect(ids(compat.state)).toEqual([1, 2, 4]);
    expect(compat.state.filters).toEqual([
      { field: 'state', values: ['done'], type: 'none' },
      { field: 'cost', values: [{ exists: true }], type: 'any' },
    ]);

    compat.actions.setSearchTerm('done');
    await driver.settled();
    expect(compat.state.filters).toEqual([]);
    expect(compat.state.searchTerm).toBe('done');
    compat.actions.setSearchTerm('created', { shouldClearFilters: false });
    expect(compat.state.searchTerm).toBe('created');
  });

  test('field filters live next to query-builder nodes without touching them', async () => {
    const { driver, compat } = setup({
      page: { kind: 'offset', page: 1, perPage: 20 },
    });
    driver.add('root', or(eq('state', 'done'), eq('cost', 10)));
    compat.actions.setFilter('tags', 'a');
    await driver.settled();
    expect(compat.state.filters).toEqual([
      { field: 'tags', values: ['a'], type: 'any' },
    ]);
    expect(ids(compat.state)).toEqual([1]);
    compat.actions.clearFilters();
    await driver.settled();
    expect(driver.state.filter.children).toHaveLength(1); // the OR group stays
    expect(ids(compat.state)).toEqual([1, 3, 5]);
  });

  test('subscribeToStateChanges / unsubscribeToStateChanges', async () => {
    const { driver, compat } = setup();
    const seen: number[] = [];
    const listener = (state: SearchUiState) => seen.push(state.current);
    compat.subscribeToStateChanges(listener);
    compat.subscribeToStateChanges(listener); // idempotent, like search-ui
    compat.actions.setCurrent(2);
    await driver.settled();
    compat.unsubscribeToStateChanges(listener);
    compat.actions.setCurrent(3);
    await driver.settled();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((page) => page === 2)).toBe(true);
  });

  test('rawResponse and errors', async () => {
    const driver = new SearchDriver({
      backend: {
        codec: { serialize: () => ({}) },
        search: () => Promise.reject(new Error('boom')),
        normalize: () => ({ results: [], total: 0 }),
      },
    });
    const compat = searchUiCompat(driver);
    compats.push(compat);
    await driver.settled();
    expect(compat.state.error).toBe('An unexpected error occurred: boom');

    const ok = new SearchDriver({
      backend: {
        codec: { serialize: () => ({}) },
        search: () => Promise.resolve({ data: [], meta: { total_count: 0 } }),
        normalize: () => ({ results: [], total: 0 }),
      },
    });
    const okCompat = searchUiCompat(ok);
    compats.push(okCompat);
    await ok.settled();
    expect(okCompat.state.rawResponse).toEqual({
      data: [],
      meta: { total_count: 0 },
    });
  });

  test('tearDown destroys the driver', async () => {
    const { driver, compat } = setup();
    compat.tearDown();
    compat.actions.setCurrent(2);
    await driver.settled();
    expect(driver.result.status).not.toBe('loading');
  });
});

describe('fromSearchUiState: restore a search-ui state kept in a `query` param', () => {
  test('page, size, term, sort and filters', () => {
    const state = fromSearchUiState({
      current: 3,
      resultsPerPage: 10,
      searchTerm: 'tank',
      sortField: 'created_at',
      sortDirection: 'asc',
      filters: [
        { field: 'state', values: ['created', 'pending'], type: 'any' },
        { field: 'cost', values: [{ gt: 1, lte: 5000 }] },
        { field: 'empty', values: [] },
      ],
    });
    expect(state.page).toEqual({ kind: 'offset', page: 3, perPage: 10 });
    expect(state.query.term).toBe('tank');
    expect(state.sort).toEqual([{ field: 'created_at', direction: 'asc' }]);
    expect(state.filter.children).toEqual([
      {
        kind: 'condition',
        id: expect.any(String) as string,
        field: 'state',
        operator: 'in',
        value: ['created', 'pending'],
      },
      {
        kind: 'condition',
        id: expect.any(String) as string,
        field: 'cost',
        operator: 'range',
        value: { gt: 1, lte: 5000 },
      },
    ]);
  });

  test('the compat filters and the list codec agree', async () => {
    const { driver, compat } = setup();
    compat.actions.setFilter('state', ['created', 'pending'], 'any');
    compat.actions.setFilter('cost', { gt: 1 }, 'any');
    await driver.settled();
    const request = searchApiCodec().serialize(driver.state, {
      operators: new OperatorRegistry(),
      idFactory: sequentialIds(),
    });
    expect(request.filters).toEqual(
      compat.state.filters.map(({ field, values }) => ({ field, values })),
    );
  });
});

test('onRequestStateChange reports request changes only (for URL query params)', async () => {
  const { driver, compat } = setup();
  const seen: unknown[] = [];
  const off = compat.onRequestStateChange((request) => seen.push(request));
  await driver.settled(); // results arriving do not count
  expect(seen).toEqual([]);
  compat.actions.setFilter('state', 'done', 'any');
  await driver.settled();
  expect(seen).toEqual([
    {
      current: 1,
      resultsPerPage: 2,
      searchTerm: '',
      sortField: '',
      sortDirection: '',
      filters: [{ field: 'state', values: ['done'], type: 'any' }],
    },
  ]);
  off();
  compat.actions.setCurrent(2);
  expect(seen).toHaveLength(1);
});

test('with a schema, a string on a text field is "contains" (how the search API reads it)', async () => {
  const driver = new SearchDriver<Doc>({
    backend: memoryBackend(DOCS),
    schema: { state: { path: 'state', type: 'text' } },
  });
  const compat = searchUiCompat(driver);
  compats.push(compat);
  compat.actions.setFilter('state', 'don', 'any');
  expect(driver.state.filter.children[0]).toMatchObject({
    operator: 'contains',
    value: 'don',
  });
  await driver.settled();
  expect(ids(compat.state)).toEqual([3, 5]);
  expect(compat.state.filters).toEqual([
    { field: 'state', values: ['don'], type: 'any' },
  ]);
  const restored = fromSearchUiState(
    { filters: [{ field: 'state', values: ['don'] }] },
    undefined,
    { state: { path: 'state', type: 'text' } },
  );
  expect(restored.filter.children[0]).toMatchObject({ operator: 'contains' });
});

describe('arrays: "keep" (search-ui 1.20 and older)', () => {
  const codecCtx = {
    operators: new OperatorRegistry(),
    idFactory: sequentialIds(),
  };

  function keep() {
    const driver = new SearchDriver<Doc>({
      backend: memoryBackend(DOCS),
      idFactory: sequentialIds(),
      initialState: { page: { kind: 'offset', page: 1, perPage: 20 } },
    });
    const compat = searchUiCompat(driver, { arrays: 'keep' });
    compats.push(compat);
    return { driver, compat };
  }

  test('setFilter keeps an array as one value, as search-ui 1.20 did', async () => {
    const { driver, compat } = keep();
    compat.setFilter('state', ['created', 'pending'], 'any');
    await driver.settled();
    // code reading values[0] (legacy filter editors) gets the array
    expect(compat.state.filters).toEqual([
      { field: 'state', values: [['created', 'pending']], type: 'any' },
    ]);
    expect(ids(compat.state)).toEqual([1, 2, 4]);
    // and the legacy list sends it nested, like the search-ui frontend
    const seen: unknown[] = [];
    const codec = searchApiCodec({
      serializeValue: (_field, value) => {
        seen.push(value);
        return value;
      },
    });
    expect(codec.serialize(driver.state, codecCtx).filters).toEqual([
      { field: 'state', values: [['created', 'pending']] },
    ]);
    expect(seen).toEqual([['created', 'pending']]); // the hook sees the array once
  });

  test('a one-item array stays an array; scalars stay scalars', async () => {
    const { driver, compat } = keep();
    compat.setFilter('state', ['done'], 'any');
    compat.setFilter('cost', { gte: 100 }, 'any');
    await driver.settled();
    expect(compat.state.filters).toEqual([
      { field: 'state', values: [['done']], type: 'any' },
      { field: 'cost', values: [{ gte: 100 }], type: 'any' },
    ]);
    expect(searchApiCodec().serialize(driver.state, codecCtx).filters).toEqual([
      { field: 'state', values: [['done']] },
      { field: 'cost', values: [{ gte: 100 }] },
    ]);
  });

  test('nested values round-trip through the request and the query param', () => {
    const codec = searchApiCodec();
    const request = { filters: [{ field: 'state', values: [['a', 'b']] }] };
    const parsed = codec.parse(request, codecCtx);
    expect(codec.serialize(parsed, codecCtx).filters).toEqual(request.filters);
    const restored = fromSearchUiState({
      filters: [{ field: 'state', values: [['a', 'b']] }],
    });
    expect(nodeToFilter(restored.filter.children[0] as never)).toEqual({
      field: 'state',
      values: [['a', 'b']],
      type: 'any',
    });
  });

  test('the default flattens, as search-ui 1.21 and later', async () => {
    const { driver, compat } = setup();
    compat.setFilter('state', ['created', 'pending'], 'any');
    await driver.settled();
    expect(compat.state.filters[0]?.values).toEqual(['created', 'pending']);
    expect(searchApiCodec().serialize(driver.state, codecCtx).filters).toEqual([
      { field: 'state', values: ['created', 'pending'] },
    ]);
  });
});

test("setFilter edits the field's root condition in place, whoever added it", () => {
  const driver = new SearchDriver<Doc>({ backend: memoryBackend(DOCS) });
  const compat = searchUiCompat(driver);
  compats.push(compat);
  const id = driver.add('root', not(eq('state', 'done')));
  driver.add('root', eq('state', 'open')); // a second one on the field
  driver.add('root', or(eq('state', 'x'))); // a group: not a search-ui filter
  compat.setFilter('state', ['a', 'b'], 'any');
  expect(driver.state.filter.children).toMatchObject([
    { id, operator: 'in', value: ['a', 'b'] },
    { kind: 'group' },
  ]);
  expect(driver.state.filter.children[0]).not.toHaveProperty('negate');
  expect(compat.state.filters).toEqual([
    { field: 'state', values: ['a', 'b'], type: 'any' },
  ]);
  compat.clearFilters();
  expect(driver.state.filter.children).toMatchObject([{ kind: 'group' }]);
});
