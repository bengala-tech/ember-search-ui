import { afterEach, describe, expect, test } from 'vitest';
import {
  emberLikeCompare,
  eq,
  or,
  prysmexLocalSearch,
  PrysmexLocalCompat,
  type PrysmexLocalOptions,
} from '../src/index.ts';

// Mirrors Prysmex's offline lists: its Property class (getters for
// useFilter / filteredBy), defaultFilter, and the filtering functions the
// property builders install for a LocalSearchDriver.

type Fn = (
  row: never,
  values: unknown[],
  opts: { valueKey?: string },
) => unknown;

const getPath = (row: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>(
      (v, k) => (v == null ? undefined : (v as Record<string, unknown>)[k]),
      row,
    );

// Prysmex: '' + filterValue === get(row, valueKey)
const defaultFilter: Fn = (row, values, { valueKey }) =>
  values.some((f) => String(f) === getPath(row, valueKey!));

class Property {
  valuePath?: string;
  isFilterable?: boolean;
  _filteredBy?: string;
  localFilteringFunction: Fn = defaultFilter;
  constructor(config: Partial<Property> & { filteredBy?: string }) {
    const { filteredBy, ...rest } = config;
    Object.assign(this, rest);
    if (filteredBy) this._filteredBy = filteredBy;
  }
  get useFilter() {
    return this.filteredBy && this.isFilterable !== false;
  }
  get filteredBy() {
    return this._filteredBy || this.valuePath;
  }
}

interface Row {
  id: number;
  name: string | null;
  state: string;
  active: boolean;
  due: Date;
  zone: { name: string } | null;
}

const ROWS: Row[] = [
  {
    id: 1,
    name: 'Tank A',
    state: 'open',
    active: true,
    due: new Date('2026-01-10'),
    zone: { name: 'North' },
  },
  {
    id: 2,
    name: 'Pump B',
    state: 'closed',
    active: false,
    due: new Date('2026-02-10'),
    zone: { name: 'South' },
  },
  {
    id: 3,
    name: null,
    state: 'open',
    active: true,
    due: new Date('2026-03-10'),
    zone: null,
  },
  {
    id: 4,
    name: 'tank C',
    state: 'open',
    active: false,
    due: new Date('2026-04-10'),
    zone: { name: 'East' },
  },
];

// build-boolean-property's function
const booleanFilter: Fn = (row, values, { valueKey }) =>
  values.some((fv) =>
    fv === true || fv === 'true'
      ? Boolean(getPath(row, valueKey!))
      : !getPath(row, valueKey!),
  );

// build-date-property's function, in spirit: a range over the row's date
const dateFilter: Fn = (row, values, { valueKey }) => {
  const time = (getPath(row, valueKey!) as Date).getTime();
  return values.every((v) => {
    const { gte, lte } = v as { gte?: string; lte?: string };
    return (
      (gte === undefined || time >= Date.parse(gte)) &&
      (lte === undefined || time <= Date.parse(lte))
    );
  });
};

const properties = () => [
  new Property({ valuePath: 'name' }),
  new Property({ valuePath: 'state' }),
  new Property({ valuePath: 'active', localFilteringFunction: booleanFilter }),
  new Property({ valuePath: 'due', localFilteringFunction: dateFilter }),
  new Property({ valuePath: 'zone.name' }),
  new Property({ valuePath: 'id', isFilterable: false }),
];

const teardowns: (() => void)[] = [];
afterEach(() => teardowns.splice(0).forEach((t) => t()));

function local(options: Partial<PrysmexLocalOptions<Row>> = {}) {
  const driver = prysmexLocalSearch<Row>({
    data: ROWS,
    properties: properties(),
    ...options,
  });
  teardowns.push(driver.tearDown);
  return driver;
}

const ids = (driver: PrysmexLocalCompat<Row>) =>
  (driver.state.results as Row[]).map((r) => r.id);

async function settle(driver: PrysmexLocalCompat<Row>) {
  await driver.driver.settled();
  return ids(driver);
}

describe('prysmexLocalSearch: the old LocalConnector semantics', () => {
  test('no filters and no term: every row, in data order, 10 per page', async () => {
    const driver = local();
    expect(await settle(driver)).toEqual([1, 2, 3, 4]);
    expect(driver.state).toMatchObject({ totalResults: 4, totalPages: 1 });
  });

  test('the search term: case-insensitive over filterable properties, skipping booleans and Dates', async () => {
    const driver = local();
    driver.setSearchTerm('TANK');
    expect(await settle(driver)).toEqual([1, 4]);
    driver.setSearchTerm('north');
    expect(await settle(driver)).toEqual([1]); // zone.name
    driver.setSearchTerm('true');
    expect(await settle(driver)).toEqual([]); // `active` is boolean: skipped
    driver.setSearchTerm('2026');
    expect(await settle(driver)).toEqual([]); // `due` is a Date: skipped
    driver.setSearchTerm('3');
    expect(await settle(driver)).toEqual([]); // `id` is not filterable
    // like the old connector, a missing value reads as "null" / "undefined"
    driver.setSearchTerm('null');
    expect(await settle(driver)).toEqual([3]);
  });

  test('filteringIgnoreCase: false', async () => {
    const driver = local({ filteringIgnoreCase: false });
    driver.setSearchTerm('tank');
    expect(await settle(driver)).toEqual([4]);
  });

  test('filters run their property function: defaultFilter, boolean, date range', async () => {
    const driver = local();
    driver.setFilter('state', 'open', 'any');
    expect(await settle(driver)).toEqual([1, 3, 4]);
    driver.setFilter('active', 'false', 'any');
    expect(await settle(driver)).toEqual([4]);
    driver.clearFilters();
    driver.setFilter('due', {
      gte: new Date('2026-02-01'),
      lte: new Date('2026-03-31'),
    });
    expect(await settle(driver)).toEqual([2, 3]);
    driver.setFilter('zone.name', ['North', 'East'], 'any');
    expect(await settle(driver)).toEqual([]);
    driver.removeFilter('due');
    expect(await settle(driver)).toEqual([1, 4]);
  });

  test('filters and search term combine', async () => {
    const driver = local();
    driver.setFilter('state', 'open', 'any');
    driver.setSearchTerm('tank', { shouldClearFilters: false });
    expect(await settle(driver)).toEqual([1, 4]);
  });

  test('a filter with no matching property is ignored; type "none" negates', async () => {
    const driver = local();
    driver.setFilter('unknown', 'x', 'any');
    expect(await settle(driver)).toEqual([1, 2, 3, 4]);
    driver.setFilter('state', 'open', 'none');
    expect(await settle(driver)).toEqual([2]);
  });

  test('without filterable properties every row matches, as before', async () => {
    const driver = local({ properties: [] });
    driver.setFilter('state', 'open', 'any');
    driver.setSearchTerm('zzz', { shouldClearFilters: false });
    expect(await settle(driver)).toEqual([1, 2, 3, 4]);
  });

  test('sorting compares like Ember (null first ascending), desc reverses', async () => {
    const driver = local();
    driver.setSort('name', 'asc');
    expect(await settle(driver)).toEqual([3, 2, 1, 4]);
    driver.setSort('name', 'desc');
    expect(await settle(driver)).toEqual([4, 1, 2, 3]);
    driver.setSort('due', 'desc');
    expect(await settle(driver)).toEqual([4, 3, 2, 1]);
  });

  test('paging, and usePagination: false', async () => {
    const driver = local({ initialState: { resultsPerPage: 3, current: 2 } });
    expect(await settle(driver)).toEqual([4]);
    expect(driver.state).toMatchObject({ totalPages: 2, current: 2 });

    const all = local({
      usePagination: false,
      initialState: { resultsPerPage: 3 },
    });
    expect(await settle(all)).toEqual([1, 2, 3, 4]);
    expect(all.state.totalPages).toBe(2); // computed as before
  });

  test('setData / setProperties / runSearch search again on the same page', async () => {
    const driver = local({ data: [], initialState: { resultsPerPage: 2 } });
    expect(await settle(driver)).toEqual([]);
    driver.setData(ROWS);
    expect(await settle(driver)).toEqual([1, 2]);
    driver.setCurrent(2);
    expect(await settle(driver)).toEqual([3, 4]);

    driver.setData(ROWS.slice().reverse());
    expect(await settle(driver)).toEqual([2, 1]);
    expect(driver.state.current).toBe(2);

    driver.setFilter('state', 'closed', 'any');
    driver.setCurrent(1);
    expect(await settle(driver)).toEqual([2]);
    driver.setProperties([new Property({ valuePath: 'name' })]);
    expect(await settle(driver)).toEqual([4, 3]); // no `state` property now

    const rows = ROWS.slice(0, 1);
    driver.setData(rows);
    await driver.driver.settled();
    rows.push(ROWS[1]!); // mutated in place, as Prysmex sometimes does
    driver.runSearch();
    expect(await settle(driver)).toEqual([1, 2]);
  });

  test('a custom `get` (Ember get for proxies) is used for filters, search and sort', async () => {
    const reads: string[] = [];
    const driver = local({
      get: (row, path) => {
        reads.push(path);
        return getPath(row, path);
      },
    });
    driver.setSearchTerm('tank');
    driver.setSort('id', 'desc');
    expect(await settle(driver)).toEqual([4, 1]);
    expect(reads).toContain('zone.name');
    expect(reads).toContain('id');
  });

  test('query-builder nodes apply next to the search-ui filters', async () => {
    const driver = local();
    driver.setFilter('state', 'open', 'any');
    driver.driver.add('root', or(eq('id', 1), eq('id', 2), eq('id', 3)));
    expect(await settle(driver)).toEqual([1, 3]);
  });

  test('it is a class Prysmex can export as LocalSearchDriver (instanceof checks)', () => {
    expect(local()).toBeInstanceOf(PrysmexLocalCompat);
  });
});

describe('emberLikeCompare', () => {
  test('type order, then values', () => {
    // wrapped: Array#sort moves bare undefined to the end without comparing
    const values = [3, 'b', null, true, undefined, 'a', [1], 1, false];
    const sorted = values
      .map((value) => ({ value }))
      .sort((x, y) => emberLikeCompare(x.value, y.value))
      .map((x) => x.value);
    expect(sorted).toEqual([undefined, null, false, true, 1, 3, 'a', 'b', [1]]);
  });

  test('dates, arrays, and objects by compare() or valueOf() (moment)', () => {
    expect(emberLikeCompare(new Date(1), new Date(2))).toBe(-1);
    expect(emberLikeCompare([1, 2], [1, 3])).toBe(-1);
    expect(emberLikeCompare([1], [1, 0])).toBe(-1);
    const m = (n: number) => ({ valueOf: () => n });
    expect(emberLikeCompare(m(5), m(2))).toBe(1);
    const c = (n: number) => ({
      n,
      compare: (a: { n: number }, b: { n: number }) => a.n - b.n,
    });
    expect(emberLikeCompare(c(1), c(4))).toBe(-3);
    expect(emberLikeCompare({}, {})).toBe(0);
  });
});
