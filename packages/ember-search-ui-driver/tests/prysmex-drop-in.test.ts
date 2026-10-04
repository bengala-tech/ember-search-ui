import { afterEach, describe, expect, test } from 'vitest';
import {
  SearchDriver,
  memoryBackend,
  prysmexCodec,
  prysmexServerSearch,
  searchUiCompat,
  sequentialIds,
  type PrysmexRequest,
  type PrysmexServerSearchOptions,
} from '../src/index.ts';

// Each test repeats what a Prysmex call site does with its search driver
// today (read from the Prysmex frontend), against the new driver.

interface Doc {
  id: number;
  state: string;
  created_at: string;
}

const DOCS: Doc[] = [
  { id: 1, state: 'created', created_at: '2026-01-05T10:00:00.000Z' },
  { id: 2, state: 'done', created_at: '2026-02-10T10:00:00.000Z' },
  { id: 3, state: 'created', created_at: '2026-02-20T10:00:00.000Z' },
  { id: 4, state: 'done', created_at: '2026-03-15T10:00:00.000Z' },
];

const teardowns: (() => void)[] = [];
afterEach(() => teardowns.splice(0).forEach((t) => t()));

function memory() {
  const driver = new SearchDriver<Doc>({
    backend: memoryBackend(DOCS),
    idFactory: sequentialIds(),
    schema: { created_at: { path: 'created_at', type: 'date' } },
  });
  const compat = searchUiCompat(driver);
  teardowns.push(compat.tearDown);
  return { driver, compat };
}

const ids = (results: unknown[]) => (results as Doc[]).map((d) => d.id);
const listOf = (driver: SearchDriver<Doc>) =>
  driver.export(prysmexCodec()).filters;

describe('actions on the driver itself (search-ui copies them there)', () => {
  test('driver.setFilter / setCurrent / clearFilters, as calendar and multi-search call them', async () => {
    const { driver, compat } = memory();
    compat.setFilter('state', 'done', 'any');
    compat.setResultsPerPage(1);
    compat.setCurrent(2);
    await driver.settled();
    expect(ids(compat.state.results)).toEqual([4]);
    expect(compat.state.current).toBe(2);

    compat.clearFilters();
    compat.setSort('id', 'asc');
    await driver.settled();
    expect(compat.state.filters).toEqual([]);
    expect(compat.state.sortField).toBe('id');
    // the same functions as `actions`, bound
    expect(compat.setFilter).toBe(compat.actions.setFilter);
  });
});

describe('date-like values', () => {
  test('the calendar: setFilter(field, { gte: Date, lte: Date })', async () => {
    const { driver, compat } = memory();
    const start = new Date('2026-02-01T00:00:00.000Z');
    const end = new Date('2026-03-01T00:00:00.000Z');
    compat.setFilter('created_at', { gte: start, lte: end });
    await driver.settled();
    expect(ids(compat.state.results)).toEqual([2, 3]);
    // sent like JSON.stringify sends a Date
    expect(listOf(driver)).toEqual([
      {
        field: 'created_at',
        values: [{ gte: start.toISOString(), lte: end.toISOString() }],
      },
    ]);
    expect(compat.state.filters[0]?.values).toEqual([
      { gte: start.toISOString(), lte: end.toISOString() },
    ]);
  });

  test('moment-like objects (anything with toISOString) and single dates', async () => {
    const { driver, compat } = memory();
    const momentLike = {
      toISOString: () => '2026-02-15T00:00:00.000Z',
      format: () => 'not used',
    };
    compat.setFilter('created_at', { gt: momentLike });
    await driver.settled();
    expect(ids(compat.state.results)).toEqual([3, 4]);

    compat.setFilter('created_at', new Date('2026-03-15T10:00:00.000Z'));
    await driver.settled();
    expect(ids(compat.state.results)).toEqual([4]);
    expect(listOf(driver)).toEqual([
      { field: 'created_at', values: ['2026-03-15T10:00:00.000Z'] },
    ]);
  });
});

describe('values no operator covers are sent as they are', () => {
  test('an object of unknown shape is kept, not dropped', async () => {
    const { driver, compat } = memory();
    const bounds = { top_left: [1, 2], bottom_right: [3, 4] };
    compat.setFilter('location', bounds, 'any');
    await driver.settled();
    expect(listOf(driver)).toEqual([{ field: 'location', values: [bounds] }]);
    expect(compat.state.filters).toEqual([
      { field: 'location', values: [bounds], type: 'any' },
    ]);
  });

  test('multi-search: setFilter(field, filter.values) with object values', async () => {
    const { driver, compat } = memory();
    const values = [{ id: 1 }, { id: 2 }];
    compat.setFilter('owner', values);
    await driver.settled();
    expect(listOf(driver)).toEqual([{ field: 'owner', values }]);
    expect(compat.state.filters[0]?.values).toEqual(values);
  });

  test('parsing an unknown shape keeps it instead of throwing', () => {
    const codec = prysmexCodec();
    const ctx = memory().driver.codecContext;
    const request: PrysmexRequest = {
      filters: [{ field: 'location', values: [{ near: 'x' }] }],
    };
    const state = codec.parse(request, ctx);
    expect(state.filter.children[0]).toMatchObject({
      operator: 'raw',
      value: { near: 'x' },
    });
    expect(codec.serialize(state, ctx).filters).toEqual(request.filters);
  });
});

describe('prysmexServerSearch: the ServerSearchDriver API', () => {
  interface Sent {
    endpoint: string;
    request: PrysmexRequest;
    extra: Record<string, unknown>;
  }

  function server(options: Partial<PrysmexServerSearchOptions> = {}) {
    const sent: Sent[] = [];
    const compat = prysmexServerSearch<{ id: number }>({
      endpoint: 'inspections',
      include: 'location',
      // like Prysmex's document adapter: dates as YYYY-MM-DD. It gets one
      // entry of `values` at a time: a string or a whole range object.
      serializeValue: (field, value) => {
        if (field !== 'document.due') return value;
        const day = (v: unknown) =>
          typeof v === 'string' ? v.slice(0, 10) : v;
        return typeof value === 'object' && value !== null
          ? Object.fromEntries(
              Object.entries(value).map(([key, bound]) => [key, day(bound)]),
            )
          : day(value);
      },
      send: (endpoint, request, extra) => {
        sent.push({ endpoint, request, extra });
        return Promise.resolve({
          data: [{ id: 1 }],
          meta: { total_count: 1, total_pages: 1 },
        });
      },
      ...options,
    });
    teardowns.push(compat.tearDown);
    return { compat, sent };
  }

  test('searches send the old request, with include and an abort signal', async () => {
    const { compat, sent } = server();
    compat.setFilter('state', ['created', 'done'], 'any');
    await compat.driver.settled();
    const last = sent.at(-1)!;
    expect(last.endpoint).toBe('inspections');
    expect(last.request).toEqual({
      filters: [{ field: 'state', values: ['created', 'done'] }],
      page: 1,
      per: 10,
      include: 'location',
    });
    expect(last.extra['signal']).toBeInstanceOf(AbortSignal);
    expect(compat.state.results).toEqual([{ id: 1 }]);
  });

  test('afterSearch runs on searches (store.pushPayload), not on makeSearch', async () => {
    let calls = 0;
    const { compat } = server({
      afterSearch: (response) => {
        calls++;
        return { ...response, results: ['pushed'] };
      },
    });
    await compat.driver.settled();
    expect(compat.state.results).toEqual(['pushed']);
    await compat.makeSearch(compat.getSerializedState());
    expect(calls).toBe(1);
  });

  test('helpers/get-serialized-state: prepareRequest(serializeState(getState()))', async () => {
    const { compat } = server();
    compat.setFilter('document.due', { gte: '2026-02-01T08:00:00.000Z' });
    compat.setSearchTerm('tank', { shouldClearFilters: false });
    compat.setSort('created_at', 'asc');
    await compat.driver.settled();
    const { apiConnector } = compat;
    expect(
      apiConnector.prepareRequest(
        apiConnector.serializeState(compat.getState()),
      ),
    ).toEqual({
      search: 'tank',
      sort: 'created_at',
      sort_direction: 'asc',
      page: 1,
      per: 10,
      // the value hook ran, per value like serializeFilters
      filters: [{ field: 'document.due', values: [{ gte: '2026-02-01' }] }],
    });
  });

  test('export-to-excel: serializeState, change the page, makeSearch to another endpoint', async () => {
    const { compat, sent } = server();
    compat.setFilter('state', 'done', 'any');
    await compat.driver.settled();
    const serialized = compat.apiConnector.serializeState(compat.getState());
    serialized.current = 1;
    serialized.resultsPerPage = 5000;
    const extra = { method: 'POST', body: { exportConfig: {} } };
    await compat.apiConnector.makeSearch(
      `${compat.apiConnector.endpoint}.xlsx`,
      serialized,
      extra,
    );
    expect(sent.at(-1)).toEqual({
      endpoint: 'inspections.xlsx',
      request: {
        include: 'location',
        filters: [{ field: 'state', values: ['done'] }],
        page: 1,
        per: 5000,
      },
      extra,
    });
  });

  test('users controller: driver.getSerializedState() and driver.makeSearch(state, extra)', async () => {
    const { compat, sent } = server();
    compat.setFilter('role', 'admin', 'any');
    await compat.driver.settled();
    const serialized = compat.getSerializedState();
    serialized.current = 1;
    serialized.resultsPerPage = 9999;
    await compat.makeSearch(serialized, {
      body: { fields: { users: ['id'] } },
    });
    expect(sent.at(-1)).toMatchObject({
      endpoint: 'inspections',
      request: { per: 9999, filters: [{ field: 'role', values: ['admin'] }] },
      extra: { body: { fields: { users: ['id'] } } },
    });
  });

  test('the query param round trip: serialized out, parseValue back in', async () => {
    const seen: unknown[] = [];
    const parseValue = (field: string, value: unknown) =>
      field === 'document.due' && typeof value === 'string'
        ? `${value}T00:00:00.000Z`
        : value;
    const { compat } = server({ parseValue });
    compat.onSerializedStateChange((state) => seen.push(state));
    compat.setFilter('document.due', '2026-02-01T08:00:00.000Z');
    await compat.driver.settled();
    const query = seen.at(-1) as { filters: unknown };
    expect(query).toMatchObject({
      current: 1,
      filters: [{ field: 'document.due', values: ['2026-02-01'] }],
    });

    const { compat: restored } = server({
      parseValue,
      initialState: query as never,
    });
    expect(restored.getState().filters).toEqual([
      {
        field: 'document.due',
        values: ['2026-02-01T00:00:00.000Z'],
        type: 'any',
      },
    ]);
  });

  test('a query-builder group next to the search-ui filters is serialized too', async () => {
    const { compat } = server({ filters: 'groups' });
    compat.setFilter('state', 'done', 'any');
    compat.driver.add('root', {
      kind: 'group',
      op: 'or',
      children: [
        { kind: 'condition', field: 'a', operator: 'eq', value: 1 },
        { kind: 'condition', field: 'b', operator: 'eq', value: 2 },
      ],
    });
    await compat.driver.settled();
    expect(compat.getSerializedState().filters).toEqual({
      type: 'all',
      filters: [
        { state: 'done' },
        { type: 'any', filters: [{ a: 1 }, { b: 2 }] },
      ],
    });
  });
});
