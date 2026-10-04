import { describe, expect, test } from 'vitest';
import {
  SearchDriver,
  and,
  defaultOperator,
  defineProperty,
  eq,
  exportValue,
  extendProperty,
  findProperty,
  isExportable,
  isFilterable,
  isSortable,
  memoryBackend,
  nested,
  not,
  operatorsFor,
  optionsFor,
  propertyMatcher,
  propertyValue,
  schemaFrom,
  sortPath,
  staticOptions,
  type Option,
  type OptionsSource,
  type Property,
} from '../src/index.ts';

interface Visit {
  id: number;
  createdAt: string;
  project: { id: number; name: string };
  state: string;
  score: number;
  checks: { status: string; area: string }[];
}

const VISITS: Visit[] = [
  {
    id: 1,
    createdAt: '2026-01-10',
    project: { id: 7, name: 'Plant' },
    state: 'open',
    score: 80,
    checks: [{ status: 'ok', area: 'roof' }],
  },
  {
    id: 2,
    createdAt: '2026-02-10',
    project: { id: 8, name: 'Depot' },
    state: 'closed',
    score: 55,
    checks: [{ status: 'fail', area: 'roof' }],
  },
  {
    id: 3,
    createdAt: '2026-03-10',
    project: { id: 7, name: 'Plant' },
    state: 'open',
    score: 95,
    checks: [{ status: 'fail', area: 'dock' }],
  },
];

const project = defineProperty<Visit, string>({
  key: 'project',
  label: 'Project',
  field: { path: 'project.id', type: 'keyword' },
  value: (visit) => visit.project.name,
  sort: { path: 'project.name' },
  link: (visit) => ({ route: 'projects.show', models: [visit.project.id] }),
});

describe('defineProperty', () => {
  test('fills key from field.path and field.label from label', () => {
    const state = defineProperty({
      label: 'State',
      field: { path: 'state', type: 'keyword' },
    });
    expect(state.key).toBe('state');
    expect(state.field.label).toBe('State');
    expect(project.key).toBe('project');
  });

  test('returns a frozen copy, deeply for plain data', () => {
    const input = {
      label: 'Score',
      field: { path: 'score', type: 'number' as const },
      views: {} as Record<string, unknown>,
    };
    const score = defineProperty(input);
    expect(Object.isFrozen(score)).toBe(true);
    expect(Object.isFrozen(score.field)).toBe(true);
    expect(score.field).not.toBe(input.field); // the input stays the caller's
    expect(Object.isFrozen(input.field)).toBe(false);
  });

  test('leaves class instances (options sources, components) unfrozen', () => {
    class Remote implements OptionsSource {
      calls = 0;
      load() {
        this.calls++;
        return Promise.resolve([]);
      }
    }
    const remote = new Remote();
    const owner = defineProperty({
      label: 'Owner',
      field: { path: 'owner', type: 'keyword' },
      filter: { options: remote },
    });
    const filter = owner.filter;
    expect(filter && filter.options).toBe(remote);
    expect(Object.isFrozen(remote)).toBe(false);
  });

  test('rejects incomplete definitions', () => {
    expect(() =>
      defineProperty({ label: '', field: { path: 'a', type: 'keyword' } }),
    ).toThrow('needs a label');
    expect(() =>
      defineProperty({ label: 'A', field: { path: '', type: 'keyword' } }),
    ).toThrow('needs field.path');
    expect(() =>
      defineProperty({
        label: 'A',
        field: { path: 'a', type: 'keyword' },
        filter: { operators: ['eq'], defaultOperator: 'in' },
      }),
    ).toThrow('defaultOperator "in" is not in operators');
  });
});

describe('extendProperty', () => {
  test('merges plain objects deeply and replaces the rest', () => {
    const base = defineProperty<Visit>({
      label: 'Score',
      field: { path: 'score', type: 'number' },
      views: { table: { width: 120 } },
      filter: { operators: ['range', 'eq'] },
    });
    const wide = extendProperty(base, {
      views: { table: { fixed: 'left' } },
      filter: { defaultOperator: 'eq' },
    });
    expect(wide.views).toEqual({ table: { width: 120, fixed: 'left' } });
    expect(wide.filter).toEqual({
      operators: ['range', 'eq'],
      defaultOperator: 'eq',
    });
    expect(base.filter).toEqual({ operators: ['range', 'eq'] }); // untouched

    expect(extendProperty(base, { filter: false }).filter).toBe(false);
    expect(Object.isFrozen(wide.views)).toBe(true);
  });

  test('a defaulted key and field.label follow the overrides', () => {
    const base = defineProperty({
      label: 'User',
      field: { path: 'user.id', type: 'keyword' },
    });
    const createdBy = extendProperty(base, {
      label: 'Created by',
      field: { path: 'created_by.id' },
    });
    expect(createdBy.key).toBe('created_by.id');
    expect(createdBy.field).toMatchObject({
      path: 'created_by.id',
      type: 'keyword',
      label: 'Created by',
    });
    // an explicit key stays
    expect(
      extendProperty(project, { field: { path: 'project.uuid' } }).key,
    ).toBe('project');
  });
});

describe('reading a property', () => {
  const visit = VISITS[0]!;

  test('value, link, sort path, export', () => {
    expect(propertyValue(project, visit)).toBe('Plant');
    const state = defineProperty<Visit>({
      label: 'State',
      field: { path: 'state', type: 'keyword' },
    });
    expect(propertyValue(state, visit)).toBe('open'); // from field.path
    expect(project.link?.(visit)).toEqual({
      route: 'projects.show',
      models: [7],
    });
    expect(sortPath(project)).toBe('project.name');
    expect(sortPath(state)).toBe('state');
    expect(exportValue(project, visit)).toBe('Plant');

    const hidden = extendProperty(state, {
      sort: false,
      filter: false,
      export: false,
    });
    expect([
      isSortable(hidden),
      isFilterable(hidden),
      isExportable(hidden),
    ]).toEqual([false, false, false]);
    expect(sortPath(hidden)).toBeUndefined();
    expect(operatorsFor(hidden)).toEqual([]);

    const upper = extendProperty(state, {
      export: { value: (v) => v.state.toUpperCase() },
    });
    expect(exportValue(upper, visit)).toBe('OPEN');
  });

  test('a custom get reads records behind proxies', () => {
    const proxy = {
      get: (key: string) => (key === 'state' ? 'from-proxy' : undefined),
    };
    const state = defineProperty<typeof proxy>({
      label: 'State',
      field: { path: 'state', type: 'keyword' },
    });
    expect(propertyValue(state, proxy, (r, path) => r.get(path))).toBe(
      'from-proxy',
    );
  });
});

describe('operators and options', () => {
  const p = (field: Property['field'], filter?: Property['filter']) =>
    defineProperty({
      label: 'X',
      field,
      ...(filter === undefined ? {} : { filter }),
    });

  test('defaults by field type', () => {
    expect(operatorsFor(p({ path: 'a', type: 'keyword' }))).toEqual([
      'eq',
      'in',
      'exists',
    ]);
    expect(
      operatorsFor(
        p({
          path: 'a',
          type: 'keyword',
          options: [{ value: 1, label: 'One' }],
        }),
      ),
    ).toEqual(['in', 'eq', 'exists']);
    expect(operatorsFor(p({ path: 'a', type: 'text' }))).toEqual([
      'contains',
      'exists',
    ]);
    expect(operatorsFor(p({ path: 'a', type: 'number' }))).toEqual([
      'eq',
      'range',
      'exists',
    ]);
    expect(operatorsFor(p({ path: 'a', type: 'date' }))).toEqual([
      'range',
      'eq',
      'exists',
    ]);
    expect(operatorsFor(p({ path: 'a', type: 'boolean' }))).toEqual(['eq']);
    expect(operatorsFor(p({ path: 'a', type: 'custom' }))).toEqual([
      'eq',
      'exists',
    ]);
    expect(defaultOperator(p({ path: 'a', type: 'date' }))).toBe('range');
  });

  test('filter.operators, then field.operators, win', () => {
    expect(
      operatorsFor(p({ path: 'a', type: 'text', operators: ['prefix'] })),
    ).toEqual(['prefix']);
    const spec = p(
      { path: 'a', type: 'text', operators: ['prefix'] },
      {
        operators: ['contains', 'prefix'],
        defaultOperator: 'prefix',
      },
    );
    expect(operatorsFor(spec)).toEqual(['contains', 'prefix']);
    expect(defaultOperator(spec)).toBe('prefix');
  });

  test('staticOptions and optionsFor', async () => {
    const signal = new AbortController().signal;
    const states: Option[] = [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ];
    const source = staticOptions(states);
    expect(await source.load(signal)).toEqual(states);
    expect(await source.search!('CLO', signal)).toEqual([states[1]]);
    expect(await source.search!('  ', signal)).toEqual(states);
    expect(await source.resolve!(['open'], signal)).toEqual([states[0]]);

    const fromField = optionsFor(
      p({ path: 's', type: 'keyword', options: states }),
    );
    expect(await fromField!.load(signal)).toEqual(states);
    expect(optionsFor(p({ path: 's', type: 'keyword' }))).toBeUndefined();
    expect(
      optionsFor(p({ path: 's', type: 'keyword', options: states }, false)),
    ).toBeUndefined();
  });
});

describe('lists of properties', () => {
  const state = defineProperty<Visit>({
    label: 'State',
    field: { path: 'state', type: 'keyword' },
  });

  test('schemaFrom builds the driver schema; findProperty by key or path', () => {
    const properties = [project, state];
    expect(schemaFrom(properties)).toEqual({
      'project.id': { path: 'project.id', type: 'keyword', label: 'Project' },
      state: { path: 'state', type: 'keyword', label: 'State' },
    });
    expect(findProperty(properties, 'project')).toBe(project);
    expect(findProperty(properties, 'project.id')).toBe(project);
    expect(findProperty(properties, 'nope')).toBeUndefined();
  });

  test('two properties on one path must agree on its type', () => {
    const again = extendProperty(state, {
      key: 'state-2',
      label: 'State again',
    });
    expect(Object.keys(schemaFrom([state, again]))).toEqual(['state']);
    const clash = extendProperty(state, {
      key: 'state-text',
      field: { type: 'text' },
    });
    expect(() => schemaFrom([state, clash])).toThrow(
      'types "state" as text, another property as keyword',
    );
  });

  test('typed properties fit the list helpers (checked by tsc)', () => {
    const list: Property<Visit, string>[] = [project];
    expect(Object.keys(schemaFrom(list))).toEqual(['project.id']);
    expect(isSortable(project)).toBe(true);
    expect(operatorsFor(project)).toEqual(['eq', 'in', 'exists']);
  });
});

describe('in-memory search with properties', () => {
  // `filter.local` replaces the operator: a score filter `eq: 'high'` means 90+
  const score = defineProperty<Visit>({
    label: 'Score',
    field: { path: 'score', type: 'number' },
    filter: {
      local: (visit, condition) =>
        condition.value === 'high'
          ? visit.score >= 90
          : visit.score === condition.value,
    },
  });
  // and inside a nested scope, by full path
  const checkStatus = defineProperty<Visit['checks'][number]>({
    label: 'Check status',
    field: { path: 'checks.status', type: 'keyword' },
    filter: {
      local: (check, condition) =>
        typeof condition.value === 'string' &&
        check.status === condition.value.toLowerCase(),
    },
  });

  async function search(...filters: Parameters<typeof and>) {
    const driver = new SearchDriver<Visit>({
      backend: memoryBackend(VISITS, {
        match: propertyMatcher([
          score,
          checkStatus as Property<never, unknown>,
        ]),
      }),
      initialState: {
        filter: { kind: 'group', id: 'root', op: 'and', children: [] },
      },
    });
    driver.add('root', and(...filters));
    await driver.settled();
    const ids = driver.result.results.map((v) => v.id);
    driver.destroy();
    return ids;
  }

  test('filter.local decides, negation still applies', async () => {
    expect(await search(eq('score', 'high'))).toEqual([3]);
    expect(await search(not(eq('score', 'high')))).toEqual([1, 2]);
    expect(await search(eq('score', 55))).toEqual([2]);
  });

  test('inside nested scopes, by the full path', async () => {
    expect(await search(nested('checks', eq('status', 'FAIL')))).toEqual([
      2, 3,
    ]);
  });

  test('properties without local keep the operator meaning', async () => {
    expect(await search(eq('state', 'open'))).toEqual([1, 3]);
  });

  test('a custom get reads every path: filters, sort and text search', async () => {
    const records = VISITS.map((v) => ({
      get: (path: string) =>
        path === 'state'
          ? v.state
          : path === 'score'
            ? v.score
            : path === 'title'
              ? `Visit ${v.id}`
              : undefined,
    }));
    const driver = new SearchDriver({
      backend: memoryBackend(records, {
        get: (doc, path) => (doc as (typeof records)[number]).get(path),
        searchFields: ['title'],
      }),
    });
    driver.add('root', eq('state', 'open'));
    driver.setSort([{ field: 'score', direction: 'desc' }]);
    driver.setQuery('visit');
    await driver.settled();
    expect(driver.result.results.map((r) => r.get('score'))).toEqual([95, 80]);
    driver.setQuery('visit 1');
    await driver.settled();
    expect(driver.result.results.map((r) => r.get('score'))).toEqual([80]);
    driver.destroy();
  });
});
