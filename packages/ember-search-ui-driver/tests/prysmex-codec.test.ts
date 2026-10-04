import { describe, expect, test } from 'vitest';
import {
  OperatorRegistry,
  SearchDriver,
  UnsupportedNodeError,
  and,
  anyOf,
  contains,
  createState,
  date,
  dateMath,
  disabled,
  eq,
  exists,
  materialize,
  matches,
  nested,
  not,
  or,
  prefix,
  prysmexBackend,
  prysmexCodec,
  prysmexGroupFilters,
  prysmexListFilters,
  range,
  sequentialIds,
  withId,
  type CodecContext,
  type FieldSchema,
  type GroupNode,
  type NodeInput,
  type PrysmexFilterList,
  type PrysmexRequest,
  type SearchState,
} from '../src/index.ts';

const ctx = (schema?: FieldSchema): CodecContext => ({
  operators: new OperatorRegistry(),
  idFactory: sequentialIds('t'),
  ...(schema ? { schema } : {}),
});

const root = (...children: NodeInput[]): GroupNode =>
  materialize(
    { ...and(...children), id: 'root' },
    sequentialIds(),
  ) as GroupNode;

const state = (patch: Partial<SearchState>) => createState(patch);

describe('prysmexCodec (list format: what Prysmex sends today)', () => {
  const codec = prysmexCodec();

  test('produces the same request as the search-ui based frontend', () => {
    const request = codec.serialize(
      state({
        query: { term: 'tank' },
        sort: [{ field: 'created_at', direction: 'desc' }],
        page: { kind: 'offset', page: 2, perPage: 10 },
        extensions: { 'prysmex.include': 'author,project' },
        filter: root(
          anyOf('state', ['created', 'pending']),
          eq('created_by_id', 50),
          range('document.4-date_input455', {
            gte: dateMath('now-1w/w'),
            lte: dateMath('now'),
          }),
          range('cost', { gt: 1, lte: 5000 }),
          exists('due_at'),
          exists('closed_at', false),
        ),
      }),
      ctx(),
    );
    expect(request).toEqual({
      search: 'tank',
      sort: 'created_at',
      sort_direction: 'desc',
      page: 2,
      per: 10,
      include: 'author,project',
      filters: [
        { field: 'state', values: ['created', 'pending'] },
        { field: 'created_by_id', values: [50] },
        {
          field: 'document.4-date_input455',
          values: [{ gte: 'now-1w/w', lte: 'now' }],
        },
        { field: 'cost', values: [{ gt: 1, lte: 5000 }] },
        { field: 'due_at', values: [{ exists: true }] },
        { field: 'closed_at', values: [{ exists: false }] },
      ],
    });
  });

  test('disabled and incomplete conditions are left out; AND groups flatten', () => {
    const request = codec.serialize(
      state({
        filter: root(
          disabled(eq('a', 1)),
          anyOf('b', []),
          and(eq('c', 1), and(eq('d', 2))),
        ),
      }),
      ctx(),
    );
    expect(request.filters).toEqual([
      { field: 'c', values: [1] },
      { field: 'd', values: [2] },
    ]);
  });

  test('parses a request back, with stable ids per field', () => {
    const request: PrysmexRequest = {
      search: 'tank',
      sort: 'title',
      sort_direction: 'asc',
      page: 3,
      per: 25,
      include: 'author',
      filters: [
        { field: 'state', values: ['created', 'pending'] },
        { field: 'created_by_id', values: [50] },
        { field: 'cost', values: [{ gt: 1 }] },
        { field: 'due_at', values: [{ exists: true }] },
        { field: 'empty', values: [] },
      ],
    };
    const parsed = codec.parse(request, ctx());
    expect(parsed.query.term).toBe('tank');
    expect(parsed.sort).toEqual([{ field: 'title', direction: 'asc' }]);
    expect(parsed.page).toEqual({ kind: 'offset', page: 3, perPage: 25 });
    expect(parsed.extensions).toEqual({ 'prysmex.include': 'author' });
    expect(parsed.filter.children).toEqual([
      {
        kind: 'condition',
        id: 'filter:state',
        field: 'state',
        operator: 'in',
        value: ['created', 'pending'],
      },
      {
        kind: 'condition',
        id: 'filter:created_by_id',
        field: 'created_by_id',
        operator: 'eq',
        value: 50,
      },
      {
        kind: 'condition',
        id: 'filter:cost',
        field: 'cost',
        operator: 'range',
        value: { gt: 1 },
      },
      {
        kind: 'condition',
        id: 'filter:due_at',
        field: 'due_at',
        operator: 'exists',
        value: true,
      },
    ]);
    expect(codec.serialize(parsed, ctx())).toEqual({
      ...request,
      filters: (request.filters as PrysmexFilterList).slice(0, 4),
    });
  });

  test('dates come back as dates when the schema says so', () => {
    const schema = { due: { path: 'due', type: 'date' } };
    const parsed = codec.parse(
      {
        filters: [
          { field: 'due', values: [{ gte: 'now/M', lt: '2025-01-19' }] },
        ],
      },
      ctx(schema),
    );
    expect(parsed.filter.children[0]).toMatchObject({
      operator: 'range',
      value: { gte: { dateMath: 'now/M' }, lt: { date: '2025-01-19' } },
    });
  });

  test('refuses what the list cannot express, naming the node', () => {
    const list = prysmexListFilters();
    const cases: [NodeInput, string][] = [
      [withId('bad', or(eq('a', 1), eq('b', 2))), 'bad'],
      [withId('bad', not(eq('a', 1))), 'bad'],
      [withId('bad', nested('items', eq('a', 1))), 'bad'],
      [withId('bad', prefix('a', 'x')), 'bad'],
    ];
    for (const [input, id] of cases) {
      const tree = root(input);
      expect(list.supports(tree, ctx())).toMatchObject({
        ok: false,
        nodeId: id,
      });
      expect(() => list.serialize(tree, ctx())).toThrow(UnsupportedNodeError);
    }
    // an OR with a single active child is fine
    expect(
      list.supports(root(or(eq('a', 1), disabled(eq('b', 2)))), ctx()).ok,
    ).toBe(true);
  });

  test('value hooks run per value in both directions (e.g. Prysmex document adapters)', () => {
    const hooked = prysmexCodec({
      serializeValue: (field, value) =>
        field.startsWith('document.') && typeof value === 'number'
          ? String(value)
          : value,
      parseValue: (field, value) =>
        field.startsWith('document.') && typeof value === 'string'
          ? Number(value)
          : value,
    });
    const tree = root(anyOf('document.score', [1, 2]), eq('plain', 3));
    const request = hooked.serialize(state({ filter: tree }), ctx());
    expect(request.filters).toEqual([
      { field: 'document.score', values: ['1', '2'] },
      { field: 'plain', values: [3] },
    ]);
    expect(hooked.parse(request, ctx()).filter.children[0]).toMatchObject({
      value: [1, 2],
    });
  });

  test('cursor paging is refused', () => {
    expect(() =>
      codec.serialize(
        state({ page: { kind: 'cursor', cursor: null, size: 10 } }),
        ctx(),
      ),
    ).toThrow(/page\/per/);
  });
});

describe('prysmexCodec (groups format: the documented filter spec)', () => {
  const groups = prysmexGroupFilters();
  const keep = prysmexGroupFilters({ keepDisabled: true });

  // Every example from https://developers.prysmex.com/#filtering-pagination
  const SPEC_EXAMPLES: Record<string, unknown>[] = [
    { id: 1 },
    { state: ['created', 'pending'], id: { gt: 1, lte: 5000 } },
    {
      description: 'some text',
      due_at: null,
      cost: { exists: true },
      created_at: { gt: '2024-01-01T06:00:00', lt: '2025-01-19' },
    },
    { created_at: { gt: 'now/M', lt: 'now+1M/M' } },
    { __negate: true, state: ['done'], due_at: null },
    { __disable: true, state: ['done'] },
    {
      type: 'any',
      filters: [
        {
          __negate: true,
          state: ['created', 'pending'],
          id: { gt: 1, lte: 5000 },
        },
        { created_by_id: 50 },
      ],
    },
    {
      __negate: true,
      type: 'any',
      filters: [{ __negate: true, created_by_id: 50 }, { state: ['done'] }],
    },
    {
      type: 'any',
      filters: [
        { id: 1 },
        { state: ['done'] },
        {
          type: 'all',
          filters: [{ cost: { gt: 1 } }, { __negate: true, id: 2 }],
        },
      ],
    },
  ];

  test.each(SPEC_EXAMPLES.map((example) => [JSON.stringify(example), example]))(
    'round-trips %s',
    (_name, example) => {
      const tree = keep.parse!(example, ctx());
      expect(keep.serialize(tree, ctx())).toEqual(example);
    },
  );

  test('(x is b and u is k) or (t is k and x is c)', () => {
    const tree = root(
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    );
    expect(groups.serialize(tree, ctx())).toEqual({
      type: 'any',
      filters: [
        { x: 'b', u: 'k' },
        { t: 'k', x: 'c' },
      ],
    });
  });

  test('the same field twice in an AND needs a group', () => {
    const tree = root(
      range('id', { gt: 1 }),
      range('id', { lt: 10 }),
      not(eq('state', 'done')),
    );
    expect(groups.serialize(tree, ctx())).toEqual({
      type: 'all',
      filters: [
        { id: { gt: 1 } },
        { id: { lt: 10 } },
        { __negate: true, state: 'done' },
      ],
    });
  });

  test('disabled nodes are dropped unless kept; missing is null; dates are strings', () => {
    const tree = root(
      disabled(eq('a', 1)),
      exists('due_at', false),
      range('created_at', { gte: date('2024-01-01'), lt: dateMath('now/M') }),
    );
    expect(groups.serialize(tree, ctx())).toEqual({
      due_at: null,
      created_at: { gte: '2024-01-01', lt: 'now/M' },
    });
    expect(keep.serialize(tree, ctx())).toMatchObject({ type: 'all' });
  });

  test('parsed spec filters mean the same in memory (semantic check)', () => {
    const docs = [
      { id: 1, state: 'created', created_by_id: 50 },
      { id: 2, state: 'pending', created_by_id: 7 },
      { id: 6000, state: 'created', created_by_id: 7 },
      { id: 3, state: 'done', created_by_id: 7 },
    ];
    const tree = groups.parse!(SPEC_EXAMPLES[6]!, ctx());
    // NOT (state in [created, pending] AND 1 < id <= 5000) OR created_by_id = 50
    expect(docs.filter((d) => matches(tree, d)).map((d) => d.id)).toEqual([
      1, 6000, 3,
    ]);
  });

  test('text fields: a bare string means contains', () => {
    const schema = {
      description: { path: 'description', type: 'text' },
      state: { path: 'state', type: 'keyword' },
    };
    const tree = groups.parse!(
      { description: 'leak', state: 'open' },
      ctx(schema),
    );
    expect(tree.children).toMatchObject([
      { field: 'description', operator: 'contains', value: 'leak' },
      { field: 'state', operator: 'eq', value: 'open' },
    ]);
    expect(
      groups.supports(
        root(withId('x', eq('description', 'leak'))),
        ctx(schema),
      ),
    ).toMatchObject({
      ok: false,
      nodeId: 'x',
    });
    expect(
      groups.supports(root(withId('y', contains('state', 'op'))), ctx(schema)),
    ).toMatchObject({
      ok: false,
      nodeId: 'y',
    });
  });

  test('nested queries are refused until the Prysmex syntax is mapped', () => {
    const tree = root(withId('n', nested('requirements', eq('status', 'ok'))));
    expect(groups.supports(tree, ctx())).toMatchObject({
      ok: false,
      nodeId: 'n',
    });
  });

  test('prysmexCodec({ filters: "groups" }) sends the spec format; parse reads either', () => {
    const codec = prysmexCodec({ filters: 'groups' });
    const request = codec.serialize(
      state({ filter: root(or(eq('a', 1), not(eq('b', 2)))) }),
      ctx(),
    );
    expect(request.filters).toEqual({
      type: 'any',
      filters: [{ a: 1 }, { __negate: true, b: 2 }],
    });
    const fromList = codec.parse(
      { filters: [{ field: 'a', values: [1] }] },
      ctx(),
    );
    expect(fromList.filter.children).toHaveLength(1);
  });
});

describe('with the driver', () => {
  test('a backend built on the codec sends Prysmex requests', async () => {
    const requests: PrysmexRequest[] = [];
    const codec = prysmexCodec();
    const driver = new SearchDriver({
      backend: {
        codec,
        search: (request: PrysmexRequest) => {
          requests.push(request);
          return Promise.resolve({
            results: [{ id: '1' }],
            meta: { total_count: 41, total_pages: 5 },
          });
        },
        normalize: (response: {
          results: unknown[];
          meta: { total_count: number; total_pages: number };
        }) => ({
          results: response.results,
          total: response.meta.total_count,
          pageCount: response.meta.total_pages,
        }),
      },
      initialState: { page: { kind: 'offset', page: 1, perPage: 10 } },
    });
    driver.add('root', anyOf('state', ['open']));
    await driver.settled();
    expect(requests.at(-1)).toEqual({
      page: 1,
      per: 10,
      filters: [{ field: 'state', values: ['open'] }],
    });
    expect(driver.result).toMatchObject({ total: 41, pageCount: 5 });

    // the list format cannot OR; the search reports it instead of guessing
    driver.add('root', or(eq('a', 1), eq('b', 2)));
    await driver.settled();
    expect(driver.result.status).toBe('error');
    expect(driver.result.error).toBeInstanceOf(UnsupportedNodeError);
    driver.destroy();
  });
});

test('prysmexBackend normalizes Prysmex responses and passes the abort signal', async () => {
  const seen: { request: PrysmexRequest; aborted: boolean }[] = [];
  const driver = new SearchDriver({
    backend: prysmexBackend({
      filters: 'groups',
      request: (request, signal) => {
        seen.push({ request, aborted: signal.aborted });
        return Promise.resolve({
          data: [{ id: '1' }, { id: '2' }],
          meta: {
            total_count: 42,
            total_pages: 21,
            project_counts: { '1': 20 },
          },
        });
      },
    }),
    initialState: { page: { kind: 'offset', page: 1, perPage: 2 } },
  });
  driver.add('root', or(eq('a', 1), eq('b', 2)));
  await driver.settled();
  expect(seen.at(-1)?.request.filters).toEqual({
    type: 'any',
    filters: [{ a: 1 }, { b: 2 }],
  });
  expect(driver.result).toMatchObject({
    total: 42,
    pageCount: 21,
    results: [{ id: '1' }, { id: '2' }],
    aggregations: { project_counts: { '1': 20 } },
  });
  driver.destroy();
});
