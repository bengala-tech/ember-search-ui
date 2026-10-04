import { describe, expect, test } from 'vitest';
import {
  OperatorRegistry,
  UnsupportedNodeError,
  and,
  contains,
  createState,
  eq,
  invertPaths,
  mapStatePaths,
  materialize,
  nested,
  searchApiCodec,
  sequentialIds,
  urlCodec,
  withPaths,
  type CodecContext,
  type FieldSchema,
  type GroupNode,
  type NodeInput,
  type SearchState,
} from '../src/index.ts';

const root = (...children: NodeInput[]): GroupNode =>
  materialize(
    { ...and(...children), id: 'root' },
    sequentialIds(),
  ) as GroupNode;

const SCHEMA: FieldSchema = {
  title: { path: 'title', type: 'text' },
  createdAt: { path: 'createdAt', type: 'date' },
  'project.name': { path: 'project.name', type: 'keyword' },
};
const ctx: CodecContext = {
  operators: new OperatorRegistry(),
  idFactory: sequentialIds('t'),
  schema: SCHEMA,
};

const fields = (state: SearchState) =>
  state.filter.children.map((n) => (n.kind === 'condition' ? n.field : n.kind));

describe('mapStatePaths', () => {
  test('renames filters, sorts and search fields, with a table or a function', () => {
    const state = createState({
      filter: root(eq('createdAt', '2026-01-01'), eq('state', 'open')),
      sort: [{ field: 'createdAt', direction: 'desc' }],
      query: { term: 'x', fields: ['title', 'createdAt'] },
    });
    const table = mapStatePaths(state, { createdAt: 'created_at' });
    expect(fields(table)).toEqual(['created_at', 'state']);
    expect(table.sort[0]?.field).toBe('created_at');
    expect(table.query.fields).toEqual(['title', 'created_at']);

    const snake = (path: string) =>
      path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    expect(fields(mapStatePaths(state, snake))).toEqual([
      'created_at',
      'state',
    ]);
    expect(state.sort[0]?.field).toBe('createdAt'); // not mutated
  });

  test('sort paths apply to sorts only, before the paths', () => {
    const state = createState({
      filter: root(eq('project.name', 'Plant')),
      sort: [{ field: 'project.name', direction: 'asc' }],
    });
    const mapped = mapStatePaths(
      state,
      { 'project.name.raw': 'project.name.keyword' },
      { 'project.name': 'project.name.raw' },
    );
    expect(fields(mapped)).toEqual(['project.name']);
    expect(mapped.sort[0]?.field).toBe('project.name.keyword');
  });

  test('nested scopes: inner fields map by full path and stay relative', () => {
    const state = createState({
      filter: root(nested('checks', eq('areaName', 'roof'))),
    });
    const mapped = mapStatePaths(state, {
      checks: 'check_items',
      'checks.areaName': 'check_items.area_name',
    });
    const scope = mapped.filter.children[0]!;
    expect(scope).toMatchObject({ kind: 'nested', path: 'check_items' });
    expect(scope.kind === 'nested' && scope.filter.children[0]).toMatchObject({
      field: 'area_name',
    });

    expect(() =>
      mapStatePaths(state, {
        checks: 'check_items',
        'checks.areaName': 'elsewhere.area_name',
      }),
    ).toThrow('outside its nested scope "check_items"');
  });

  test('invertPaths refuses two paths mapped to one', () => {
    expect(invertPaths({ a: 'x', b: 'y' })).toEqual({ x: 'a', y: 'b' });
    expect(() => invertPaths({ a: 'x', b: 'x' })).toThrow(
      'Paths "a" and "b" both map to "x"',
    );
  });
});

describe('searchApiCodec with paths', () => {
  test('sends backend names and parses them back', () => {
    const codec = searchApiCodec({
      paths: { createdAt: 'created_at', 'project.name': 'project_name' },
      sortPaths: { 'project.name': 'project.name.raw' },
    });
    const state = createState({
      filter: root(eq('project.name', 'Plant'), contains('title', 'roof')),
      sort: [{ field: 'project.name', direction: 'asc' }],
    });
    const request = codec.serialize(state, ctx);
    expect(request).toMatchObject({
      filters: [
        { field: 'project_name', values: ['Plant'] },
        { field: 'title', values: ['roof'] },
      ],
      sort: 'project.name.raw',
      sort_direction: 'asc',
    });

    const parsed = codec.parse(
      {
        filters: [{ field: 'created_at', values: [{ gte: '2026-01-01' }] }],
        sort: 'created_at',
        sort_direction: 'desc',
      },
      ctx,
    );
    expect(fields(parsed)).toEqual(['createdAt']);
    // the schema is renamed too, so the date type still applies
    expect(parsed.filter.children[0]).toMatchObject({
      operator: 'range',
      value: { gte: { date: '2026-01-01' } },
    });
    expect(parsed.sort).toEqual([{ field: 'createdAt', direction: 'desc' }]);
  });

  test('field-type checks keep working under renamed paths', () => {
    const codec = searchApiCodec({ paths: { title: 'title_text' } });
    const state = createState({ filter: root(eq('title', 'roof')) });
    // "is" on a text field cannot be sent: checked against the app's schema
    expect(codec.supports(state.filter, ctx).ok).toBe(false);
    expect(() => codec.serialize(state, ctx)).toThrow(UnsupportedNodeError);
  });

  test('a function map parses back with parsePaths', () => {
    const codec = searchApiCodec({
      paths: (path) => path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
      parsePaths: (path) =>
        path.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
    });
    const state = createState({ filter: root(eq('createdAt', '2026-01-01')) });
    const request = codec.serialize(state, ctx);
    expect(request.filters).toEqual([
      { field: 'created_at', values: ['2026-01-01'] },
    ]);
    expect(fields(codec.parse(request, ctx))).toEqual(['createdAt']);
  });
});

test('withPaths wraps any codec; the URL keeps app names unless asked', () => {
  const state = createState({ filter: root(eq('createdAt', '2026-01-01')) });
  const url = urlCodec();
  const plain = url.serialize(state, ctx);
  const renamed = withPaths(url, { paths: { createdAt: 'created_at' } });
  const params = renamed.serialize(state, ctx);
  expect(plain.toString()).toContain('createdAt');
  expect(params.toString()).toContain('created_at');
  expect(fields(renamed.parse!(params, ctx))).toEqual(['createdAt']);
});
