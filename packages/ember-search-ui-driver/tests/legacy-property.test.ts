/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await --
   this file copies the legacy shape as it is written: loosely typed, async strategies */
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  OperatorRegistry,
  SearchDriver,
  configureLegacyProperties,
  createState,
  defineProperty,
  exportValue,
  extendProperty,
  findProperty,
  isFilterable,
  isLegacyProperty,
  isSortable,
  legacyOf,
  legacyValueHooks,
  memoryBackend,
  operatorsFor,
  optionsFor,
  propertyMatcher,
  propertyValue,
  schemaFrom,
  searchApiCodec,
  searchUiCompat,
  sequentialIds,
  sortPath,
  toProperties,
  toProperty,
  type LegacyNotice,
  type RouteLink,
  type UrlLink,
} from '../src/index.ts';

// A faithful copy of the legacy shape: a class with private backing fields,
// getters and setters, Object.assign in the constructor, and a default
// filtering function as a class field.

const getPath = (row: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]),
      row,
    );

type FilterFn = (
  row: any,
  values: any[],
  opts: { valueKey?: string },
) => boolean;

const defaultFilter: FilterFn = (row, values, { valueKey }) =>
  !!values.find((f) => String(f) === getPath(row, valueKey!));

// the real shapes: an interface without an index signature, generic strategies
interface LegacyViews {
  iconType?: string;
  table?: { isFeatured?: boolean; width?: number; isSortable?: boolean };
  calendar?: { isHidden?: boolean };
  mobileList?: { isFeatured?: boolean };
}
type SearchStrategy = <T>(options: T[], text: any) => Promise<T[]>;

class LegacyProp {
  private _filteredBy?: string;
  private _sortedBy?: string;
  isFilterable? = true;
  name = '';
  valuePath = '';
  exportValuePath = '';
  isSortable? = true;
  componentsForFiltering: Record<string, unknown> = {};
  property?: unknown;
  collection?: LegacyCollectionCopy;
  viewConfig: LegacyViews = {};
  propertyRoute?: string;
  propertyQuery?: string;
  routeName?: string;
  customRoute?: string;
  getUrl?: (model: any) => string | undefined;
  target?: string;
  customRouteDynamicSeg?: string[];
  skipExport = false;
  serialize?: (this: LegacyProp, value: any) => any;
  deserialize?: (this: LegacyProp, value: any) => any;
  localFilteringFunction: FilterFn = defaultFilter;

  constructor(
    config: Partial<LegacyProp> & { filteredBy?: string; sortedBy?: string },
  ) {
    Object.assign(this, config);
  }
  get useFilter() {
    return this.filteredBy && this.isFilterable !== false;
  }
  get filteredBy() {
    return this._filteredBy || this.valuePath || this.exportValuePath;
  }
  set filteredBy(value: string) {
    this._filteredBy = value;
  }
  get sortedBy() {
    return this._sortedBy || this.valuePath;
  }
  set sortedBy(value: string) {
    this._sortedBy = value;
  }
}

class LegacyCollectionCopy<T = any> {
  loads = 0;
  ensured: string[][] = [];
  constructor(
    private items: T[],
    private searchStrategy?: SearchStrategy,
  ) {}
  get options() {
    return this.items;
  }
  async load() {
    this.loads++;
    return this.items;
  }
  async loadAsync() {
    return this.load();
  }
  get search() {
    return this.searchStrategy;
  }
  async ensureLoadedForIds(ids: string[]) {
    this.ensured.push(ids);
  }
}

interface Visit {
  id: number;
  name: string;
  state: string;
  active: boolean;
  createdAt: string;
  project: { id: number; name: string; slug: string } | null;
  kind: string;
  meta: { route: string; query: Record<string, string> };
  url?: string;
}

const VISITS: Visit[] = [
  {
    id: 1,
    name: 'Tank',
    state: 'open',
    active: true,
    createdAt: '2026-01-10',
    project: { id: 7, name: 'Plant', slug: 'plant' },
    kind: 'a',
    meta: { route: 'visits.show', query: { tab: 'info' } },
    url: 'https://x.test/1',
  },
  {
    id: 2,
    name: 'Pump',
    state: 'closed',
    active: false,
    createdAt: '2026-02-10',
    project: { id: 8, name: 'Depot', slug: 'depot' },
    kind: 'b',
    meta: { route: 'visits.show', query: { tab: 'log' } },
  },
  {
    id: 3,
    name: 'Roof',
    state: 'open',
    active: false,
    createdAt: '2026-03-10',
    project: null,
    kind: 'a',
    meta: { route: 'visits.edit', query: {} },
  },
];

afterEach(() => configureLegacyProperties({ hints: false }));

describe('recognizing and converting', () => {
  test('either shape: a Property passes through, a legacy one converts', () => {
    const modern = defineProperty({
      label: 'State',
      field: { path: 'state', type: 'keyword' },
    });
    const legacy = new LegacyProp({ name: 'State', valuePath: 'state' });
    expect(isLegacyProperty(modern)).toBe(false);
    expect(isLegacyProperty(legacy)).toBe(true);
    expect(isLegacyProperty({ name: 'plain', valuePath: 'x' })).toBe(true);
    expect(toProperty(modern)).toBe(modern);
    expect(toProperty(legacy)).toMatchObject({
      key: 'state',
      label: 'State',
      field: { path: 'state', type: 'keyword', label: 'State' },
      sort: { path: 'state' },
    });
  });

  test('paths: filteredBy and sortedBy, falling back like the legacy getters', () => {
    const project = new LegacyProp({
      name: 'Project',
      valuePath: 'project.name',
      filteredBy: 'project.id',
      sortedBy: 'project.name.raw',
    });
    const converted = toProperty(project);
    expect(converted.key).toBe('project.id');
    expect(converted.field.path).toBe('project.id');
    expect(sortPath(project)).toBe('project.name.raw');
    expect(propertyValue(project, VISITS[0]!)).toBe('Plant');

    // a plain object (no class getters) follows the same rules
    const plain = { name: 'Plain', exportValuePath: 'name' };
    expect(toProperty(plain).field.path).toBe('name');
    expect(sortPath(plain)).toBeUndefined(); // no valuePath, no sortedBy
  });

  test('filterable and sortable flags', () => {
    expect(
      isFilterable(
        new LegacyProp({ name: 'A', valuePath: 'a', isFilterable: false }),
      ),
    ).toBe(false);
    expect(
      isSortable(
        new LegacyProp({ name: 'A', valuePath: 'a', isSortable: false }),
      ),
    ).toBe(false);
    // no path at all (an actions column): kept, keyed by name, not filterable or sortable
    const actions = toProperty(new LegacyProp({ name: 'Actions' }));
    expect(actions.key).toBe('legacy:Actions');
    expect([actions.filter, actions.sort]).toEqual([false, false]);
  });

  test('field type from the JSON schema, or a custom rule', () => {
    const type = (schema: unknown) =>
      toProperty(
        new LegacyProp({
          name: 'X',
          valuePath: `x${Math.random()}`,
          property: schema,
        }),
      ).field.type;
    expect(type({ type: 'string', format: 'date-time' })).toBe('date');
    expect(type({ type: 'string', format: 'date' })).toBe('date');
    expect(type({ type: ['integer', 'null'] })).toBe('number');
    expect(type({ type: 'boolean' })).toBe('boolean');
    expect(type({ type: 'string' })).toBe('keyword');
    expect(type(undefined)).toBe('keyword');
    const custom = toProperty(
      new LegacyProp({ name: 'Notes', valuePath: 'notes' }),
      {
        fieldType: (legacy) =>
          legacy.valuePath === 'notes' ? 'text' : undefined,
      },
    );
    expect(custom.field.type).toBe('text');
    expect(operatorsFor(custom)).toEqual(['contains', 'exists']);
  });

  test('views, icon, export and meta', () => {
    const table = { isFeatured: true, width: 120 };
    const legacy = new LegacyProp({
      name: 'Name',
      valuePath: 'name',
      exportValuePath: 'project.slug',
      viewConfig: { iconType: 'user', table, mobileList: { isFeatured: true } },
    });
    const converted = toProperty(legacy);
    expect(converted.icon).toBe('user');
    expect(converted.views).toEqual({
      table,
      mobileList: { isFeatured: true },
    });
    expect((converted.views as { table: unknown }).table).toBe(table); // the legacy object itself
    expect(exportValue(legacy, VISITS[0]!)).toBe('plant');
    expect(
      exportValue(new LegacyProp({ name: 'N', valuePath: 'name' }), VISITS[0]!),
    ).toBe('Tank');
    expect(
      toProperty(
        new LegacyProp({ name: 'N', valuePath: 'name', skipExport: true }),
      ).export,
    ).toBe(false);
    expect(legacyOf(converted)).toBe(legacy);
    expect(legacyOf(legacy)).toBe(legacy);
  });
});

describe('live and cached', () => {
  test('the same object gives the same Property until a field changes', () => {
    const legacy = new LegacyProp({ name: 'State', valuePath: 'state' });
    const first = toProperty(legacy);
    expect(toProperty(legacy)).toBe(first);
    legacy.filteredBy = 'status'; // a setter on the legacy class
    const second = toProperty(legacy);
    expect(second).not.toBe(first);
    expect(second.field.path).toBe('status');
  });

  test('functions read the legacy object at call time', () => {
    const legacy = new LegacyProp({ name: 'State', valuePath: 'state' });
    const converted = toProperty(legacy);
    legacy.localFilteringFunction = () => true; // builders often set this afterwards
    const filter = toProperty(legacy).filter;
    expect(
      filter &&
        filter.local!(VISITS[1]!, {
          kind: 'condition',
          id: 'c',
          field: 'state',
          operator: 'eq',
          value: 'nope',
        }),
    ).toBe(true);
    expect(converted).not.toBe(toProperty(legacy)); // the function changed: re-converted
  });

  test('legacy objects are never frozen or changed', () => {
    const table = { width: 100 };
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      viewConfig: { table },
    });
    const extended = extendProperty(legacy, {
      label: 'Status',
      views: { table: { width: 200 } },
    });
    expect(extended.label).toBe('Status');
    expect((extended.views as { table: { width: number } }).table.width).toBe(
      200,
    );
    expect(table.width).toBe(100);
    expect(Object.isFrozen(table)).toBe(false);
    expect(Object.isFrozen(legacy)).toBe(false);
    legacy.name = 'Still mutable';
    expect(legacy.name).toBe('Still mutable');
  });

  test('a custom get (Ember get) reads every path', () => {
    const reads: string[] = [];
    const get = (record: any, path: string) => {
      reads.push(path);
      return getPath(record, path);
    };
    const legacy = new LegacyProp({
      name: 'Project',
      valuePath: 'project.name',
    });
    expect(propertyValue(toProperty(legacy, { get }), VISITS[0]!)).toBe(
      'Plant',
    );
    expect(reads).toContain('project.name');
  });
});

describe('links, as the legacy table builds them', () => {
  const link = (config: Partial<LegacyProp>, record: Visit = VISITS[0]!) =>
    toProperty(
      new LegacyProp({ name: 'L', valuePath: 'name', ...config }),
    ).link?.(record);

  test('routeName links to the record id', () => {
    expect(link({ routeName: 'visits.edit' })).toEqual({
      route: 'visits.edit',
      models: [1],
    });
  });

  test('customRoute with dynamic segments; a missing segment means no link', () => {
    expect(
      link({
        customRoute: 'projects.show',
        customRouteDynamicSeg: ['project.id'],
      }),
    ).toEqual({ route: 'projects.show', models: [7] });
    expect(
      link(
        { customRoute: 'projects.show', customRouteDynamicSeg: ['project.id'] },
        VISITS[2],
      ),
    ).toBeUndefined();
    expect(
      link({
        customRoute: 'projects.show',
        customRouteDynamicSeg: 'project.slug' as never,
      }),
    ).toEqual({ route: 'projects.show', models: ['plant'] });
    expect(link({ customRoute: 'visits.index' })).toEqual({
      route: 'visits.index',
      models: [],
    });
  });

  test('propertyRoute and propertyQuery are read from the record', () => {
    expect(
      link(
        {
          propertyRoute: 'meta.route',
          propertyQuery: 'meta.query',
          customRouteDynamicSeg: ['id'],
        },
        VISITS[1],
      ),
    ).toEqual({
      route: 'visits.show',
      models: [2],
      query: { tab: 'log' },
    } satisfies RouteLink);
  });

  test('getUrl opens in _blank unless a target is set; no rule, no link', () => {
    expect(link({ getUrl: (r: Visit) => r.url })).toEqual({
      url: 'https://x.test/1',
      target: '_blank',
    } satisfies UrlLink);
    expect(link({ getUrl: (r: Visit) => r.url, target: '_self' })).toEqual({
      url: 'https://x.test/1',
      target: '_self',
    });
    expect(link({ getUrl: (r: Visit) => r.url }, VISITS[1])).toBeUndefined();
    expect(
      toProperty(new LegacyProp({ name: 'N', valuePath: 'name' })).link,
    ).toBeUndefined();
  });
});

describe('filtering exactly as before', () => {
  const booleanFilter: FilterFn = (row, values, { valueKey }) =>
    values.some((fv) =>
      fv === true || fv === 'true'
        ? !!getPath(row, valueKey!)
        : !getPath(row, valueKey!),
    );

  const properties = [
    new LegacyProp({ name: 'State', valuePath: 'state' }), // defaultFilter
    new LegacyProp({
      name: 'Active',
      valuePath: 'active',
      localFilteringFunction: booleanFilter,
    }),
    new LegacyProp({
      name: 'Project',
      valuePath: 'project.name',
      filteredBy: 'project.id',
      localFilteringFunction: (row, values) =>
        values.map(Number).includes(row.project?.id),
    }),
  ];

  async function search(
    apply: (compat: ReturnType<typeof searchUiCompat<Visit>>) => void,
  ) {
    const driver = new SearchDriver<Visit>({
      backend: memoryBackend(VISITS, { match: propertyMatcher(properties) }),
      schema: schemaFrom(properties),
    });
    const compat = searchUiCompat(driver);
    apply(compat);
    await driver.settled();
    const ids = driver.result.results.map((v) => v.id);
    compat.tearDown();
    return ids;
  }

  test('setFilter runs each legacy localFilteringFunction with the old arguments', async () => {
    expect(await search((c) => c.setFilter('state', 'open', 'any'))).toEqual([
      1, 3,
    ]);
    expect(await search((c) => c.setFilter('active', 'false', 'any'))).toEqual([
      2, 3,
    ]);
    expect(
      await search((c) => c.setFilter('project.id', ['7', '8'], 'any')),
    ).toEqual([1, 2]);
    expect(
      await search((c) => {
        c.setFilter('state', 'open', 'any');
        c.setFilter('active', 'true', 'any');
      }),
    ).toEqual([1]);
  });

  test('the function receives values flattened one level and the valueKey', async () => {
    const calls: unknown[][] = [];
    const spy = new LegacyProp({
      name: 'Kind',
      valuePath: 'kind',
      localFilteringFunction: (row, values, opts) => {
        calls.push([values, opts]);
        return row.kind === 'a';
      },
    });
    const driver = new SearchDriver<Visit>({
      backend: memoryBackend(VISITS, { match: propertyMatcher([spy]) }),
    });
    const compat = searchUiCompat(driver);
    compat.setFilter('kind', [['a', 'b'], 'c'], 'any');
    await driver.settled();
    expect(driver.result.results.map((v) => v.id)).toEqual([1, 3]);
    expect(calls[0]).toEqual([['a', 'b', 'c'], { valueKey: 'kind' }]);
    compat.tearDown();
  });

  test('negation applies around the legacy function', async () => {
    expect(await search((c) => c.setFilter('state', 'open', 'none'))).toEqual([
      2,
    ]);
  });

  test('the schema lists filterable legacy properties; lists can mix shapes', () => {
    const modern = defineProperty({
      label: 'Created',
      field: { path: 'createdAt', type: 'date' },
    });
    const hidden = new LegacyProp({
      name: 'Hidden',
      valuePath: 'secret',
      isFilterable: false,
    });
    const mixed = [...properties, modern, hidden];
    expect(Object.keys(schemaFrom(mixed))).toEqual([
      'state',
      'active',
      'project.id',
      'createdAt',
    ]);
    expect(findProperty(mixed, 'project.id')?.label).toBe('Project');
    expect(toProperties(mixed).every((p) => typeof p.key === 'string')).toBe(
      true,
    );
  });
});

describe('collections as options sources', () => {
  const PROJECTS = [
    { id: 7, name: 'Plant' },
    { id: 8, name: 'Depot' },
  ];
  const signal = new AbortController().signal;

  test('load, search and resolve through the collection', async () => {
    const collection = new LegacyCollectionCopy(
      PROJECTS,
      async (options, text) =>
        options.filter((o) =>
          (o as { name: string }).name.startsWith(String(text)),
        ),
    );
    const legacy = new LegacyProp({
      name: 'Project',
      valuePath: 'project.name',
      filteredBy: 'project.id',
      collection: collection as never,
    });
    const source = optionsFor(legacy)!;
    expect(await source.load(signal)).toEqual([
      { value: 7, label: 'Plant', data: PROJECTS[0] },
      { value: 8, label: 'Depot', data: PROJECTS[1] },
    ]);
    expect((await source.search!('De', signal)).map((o) => o.value)).toEqual([
      8,
    ]);
    expect((await source.resolve!(['7'], signal)).map((o) => o.label)).toEqual([
      'Plant',
    ]);
    expect(collection.ensured).toEqual([['7']]);
  });

  test('custom value and label keys; search falls back to labels', async () => {
    const collection = new LegacyCollectionCopy([
      { slug: 'plant', title: 'Plant site' },
    ]);
    const legacy = new LegacyProp({
      name: 'Project',
      valuePath: 'project.slug',
      collection: collection as never,
    });
    const source = optionsFor(
      toProperty(legacy, { optionValueKey: 'slug', optionLabelKey: 'title' }),
    )!;
    expect(await source.search!('SITE', signal)).toEqual([
      {
        value: 'plant',
        label: 'Plant site',
        data: { slug: 'plant', title: 'Plant site' },
      },
    ]);
  });
});

describe('serialize / deserialize as codec value hooks', () => {
  test('called per value, with the property as `this`', () => {
    const due = new LegacyProp({
      name: 'Due',
      valuePath: 'dueAt',
      filteredBy: 'document.due',
      serialize(value: string) {
        expect(this).toBe(due);
        return value.slice(0, 10);
      },
      deserialize(value: string) {
        return `${value}T00:00:00.000Z`;
      },
    });
    const hooks = legacyValueHooks([
      new LegacyProp({ name: 'A', valuePath: 'a' }),
      due,
    ]);
    const codec = searchApiCodec(hooks);
    const ctx = {
      operators: new OperatorRegistry(),
      idFactory: sequentialIds(),
    };
    const driver = new SearchDriver({
      backend: memoryBackend([]),
      searchOnInit: false,
    });
    const compat = searchUiCompat(driver);
    compat.setFilter('document.due', '2026-02-01T08:00:00.000Z', 'any');
    const request = codec.serialize(driver.state, ctx);
    expect(request.filters).toEqual([
      { field: 'document.due', values: ['2026-02-01'] },
    ]);
    const parsed = codec.parse(request, ctx);
    expect(parsed.filter.children[0]).toMatchObject({
      value: '2026-02-01T00:00:00.000Z',
    });
    expect(hooks.serializeValue('a', 5)).toBe(5); // no hook: unchanged
    compat.tearDown();
    expect(createState().filter.children).toEqual([]);
  });
});

describe('migration hints', () => {
  test('off by default', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    toProperty(new LegacyProp({ name: 'Quiet', valuePath: 'quiet1' }));
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  test('a handler receives each used legacy field once', () => {
    const notices: LegacyNotice[] = [];
    configureLegacyProperties({ hints: (n) => notices.push(n) });
    toProperty(
      new LegacyProp({
        name: 'One',
        valuePath: 'hint1',
        sortedBy: 'hint1.raw',
      }),
    );
    toProperty(new LegacyProp({ name: 'Two', valuePath: 'hint2' }));
    const fields = notices.map((n) => n.field);
    expect(new Set(fields).size).toBe(fields.length);
    expect(notices.find((n) => n.field === 'sortedBy')).toEqual({
      id: 'ember-search-ui.property.sortedBy',
      field: 'sortedBy',
      replacement: 'sort.path',
      message:
        'Legacy property field "sortedBy" is supported; its Property equivalent is sort.path.',
    });
  });

  test('true logs them with console.info', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    configureLegacyProperties({ hints: true });
    toProperty(new LegacyProp({ name: 'Logged', valuePath: 'hint3' }));
    expect(info).toHaveBeenCalledWith(
      expect.stringContaining('[ember-search-ui.property.name]'),
    );
    info.mockRestore();
  });
});
