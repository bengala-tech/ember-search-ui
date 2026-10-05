import { SearchDriver } from '../driver.ts';
import { matches } from '../evaluate.ts';
import type { Property } from '../property.ts';
import { createState } from '../state.ts';
import {
  SearchUiCompat,
  fromSearchUiState,
  nodeToFilter,
  filterToNode,
  type SearchUiCompatOptions,
  type SearchUiFilter,
  type SearchUiRequestState,
} from './search-ui.ts';
import type { Backend, FieldSchema } from '../codec.ts';
import type { OperatorRegistry } from '../operators.ts';
import type { ConditionNode, GroupNode, SearchState } from '../types.ts';

// Offline lists for apps that extended search-ui with a local connector
// (a LocalSearchDriver with setData / setProperties), over the new driver.
// The search works like such a connector:
//
// - the search term matches, case-insensitively, the text of any filterable
//   property's `filteredBy` value (booleans and Dates are skipped);
// - each search-ui filter runs its property's `localFilteringFunction(row,
//   values, { valueKey })`; filters without a property are ignored;
// - one sort field, compared like Ember's `compare`; pages of
//   `resultsPerPage` (20 when unset), or everything with usePagination: false.
//
// Groups and nested scopes (a query builder's) are applied too, with the
// driver's own operators.

const adapted = new WeakMap<object, LocalSearchProperty>();

/**
 * A Property seen as a local-search property: its field path, filterable
 * unless `filter: false`, matched by `filter.local` or else by its
 * operator's meaning. Legacy properties are used as they are.
 */
function asLocal(property: LocalSearchInput): LocalSearchProperty {
  const field = (property as { field?: unknown }).field;
  if (typeof field !== 'object' || field === null) {
    return property as LocalSearchProperty;
  }
  const cached = adapted.get(property);
  if (cached) return cached;
  const modern = property as Property<never, unknown>;
  const path = modern.field.path;
  const filter = modern.filter;
  const local: LocalSearchProperty = {
    filteredBy: path,
    useFilter: filter !== false,
    localFilteringFunction: (row: never, values: unknown[]) => {
      const node = filterToNode({ field: path, values });
      if (!node) return true;
      if (filter && filter.local) return filter.local(row, node);
      return matches(
        { kind: 'group', id: 'root', op: 'and', children: [node] },
        row,
      );
    },
  };
  adapted.set(property, local);
  return local;
}

/** The parts of a list property (column) the local search reads. */
export interface LocalSearchProperty {
  filteredBy?: string | undefined;
  /** Truthy when the property can be filtered and searched. */
  useFilter?: unknown;
  localFilteringFunction?: (
    row: never,
    values: unknown[],
    options: { valueKey?: string },
  ) => unknown;
}

/** A legacy property (or anything with its local-search fields), or a Property. */
export type LocalSearchInput = LocalSearchProperty | Property<never, unknown>;

export interface LocalSearchOptions<Doc> extends SearchUiCompatOptions {
  data?: Doc[];
  properties?: LocalSearchInput[];
  /** Default true. */
  filteringIgnoreCase?: boolean;
  /** Default true. false returns every match on one page. */
  usePagination?: boolean;
  /**
   * Reads a path from a row. Default: plain property access. Pass Ember's
   * `get` for records with proxies (belongsTo) or computed properties.
   */
  get?: (row: Doc, path: string) => unknown;
  /** Orders two sort values. Default: Ember's `compare`, as betterCompare used it. */
  compare?: (a: unknown, b: unknown) => number;
  /** The search-ui state to start from. */
  initialState?: SearchUiRequestState;
  /** Defaults under `initialState`. Default: page 1, 10 per page. */
  defaults?: SearchState;
  schema?: FieldSchema;
}

interface LocalRequest {
  searchTerm: string;
  /** The root's conditions, run by their property's filtering function. */
  filters: SearchUiFilter[];
  /** Groups and nested scopes, run with the driver's operators. */
  rest: GroupNode;
  sort: { field: string; direction: 'asc' | 'desc' } | undefined;
  page: number;
  perPage: number;
  operators: OperatorRegistry;
}

interface LocalResponse<Doc> {
  results: Doc[];
  total: number;
  pageCount: number;
}

const isRootCondition = (
  node: GroupNode['children'][number],
): node is ConditionNode => node.kind === 'condition';

/** Plain property access along a dotted path. */
function getPath(row: unknown, path: string): unknown {
  let value = row;
  for (const key of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

// --- Ember's compare, without Ember ------------------------------------------

const TYPE_ORDER: Record<string, number> = {
  undefined: 0,
  null: 1,
  boolean: 2,
  number: 3,
  string: 4,
  array: 5,
  object: 6,
  function: 8,
  date: 10,
};

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  return typeof value === 'object' ? 'object' : typeof value;
}

const spaceship = (a: number, b: number) => {
  const diff = a - b;
  return Number(diff > 0) - Number(diff < 0);
};

/**
 * Ember's `compare` (type order first, then by value), with the old
 * connector's addition: two objects compare by `compare()` or `valueOf()`
 * (moment, Date-like values).
 */
export function emberLikeCompare(v: unknown, w: unknown): number {
  if (v === w) return 0;
  const type1 = typeOf(v);
  const type2 = typeOf(w);
  if (type1 === 'object' && type2 === 'object') {
    const a = v as { compare?: unknown; valueOf(): unknown };
    const b = w as { compare?: unknown; valueOf(): unknown };
    if (typeof a.compare === 'function' && typeof b.compare === 'function')
      return (a.compare as (x: unknown, y: unknown) => number)(v, w);
    const x = a.valueOf();
    const y = b.valueOf();
    if (x !== v || y !== w) return emberLikeCompare(x, y);
    return 0;
  }
  const order = spaceship(TYPE_ORDER[type1] ?? 6, TYPE_ORDER[type2] ?? 6);
  if (order !== 0) return order;
  switch (type1) {
    case 'boolean':
    case 'number':
      return spaceship(Number(v), Number(w));
    case 'string':
      return spaceship((v as string).localeCompare(w as string), 0);
    case 'array': {
      const a = v as unknown[];
      const b = w as unknown[];
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const r = emberLikeCompare(a[i], b[i]);
        if (r !== 0) return r;
      }
      return spaceship(a.length, b.length);
    }
    case 'date':
      return spaceship((v as Date).getTime(), (w as Date).getTime());
    default:
      return 0;
  }
}

// --- the backend ------------------------------------------------------------------

/** What the local search reads; changed by setData / setProperties. */
interface LocalSource<Doc> {
  data: Doc[];
  properties: LocalSearchInput[];
}

function localBackend<Doc>(
  source: LocalSource<Doc>,
  options: LocalSearchOptions<Doc>,
): Backend<LocalRequest, LocalResponse<Doc>, Doc> {
  const ignoreCase = options.filteringIgnoreCase ?? true;
  const usePagination = options.usePagination ?? true;
  const get = options.get ?? ((row: Doc, path: string) => getPath(row, path));
  const compare = options.compare ?? emberLikeCompare;

  const filterRows = (request: LocalRequest): Doc[] => {
    const { data, properties } = source;
    if (!Array.isArray(data)) return [];
    if (request.filters.length === 0 && !request.searchTerm) return [...data];

    const filterable = properties.map(asLocal).filter((p) => p.useFilter);
    if (filterable.length === 0) return [...data];

    // the search term, over every filterable property
    const term = ignoreCase
      ? request.searchTerm.toLowerCase()
      : request.searchTerm;
    const paths = filterable
      .map((p) => p.filteredBy)
      .filter((path): path is string => Boolean(path));
    let rows = term
      ? data.filter((row) =>
          paths.some((path) => {
            const raw = get(row, path);
            if (typeof raw === 'boolean' || raw instanceof Date) return false;
            // the old connector stringified as is: null reads as "null"
            const text = ignoreCase ? String(raw).toLowerCase() : String(raw);
            return text.includes(term);
          }),
        )
      : data;

    // each filter through its property's filtering function, even two on
    // one field (a query builder's `due >= Feb` and `due <= Mar`)
    const active = request.filters
      .filter((filter) => filter.values.length > 0)
      .flatMap((filter) =>
        filterable
          .filter((p) => p.filteredBy === filter.field)
          .map((p) => ({ p, filter })),
      );
    rows = rows.filter((row) =>
      active.every(({ p, filter }) => {
        const values = filter.values.flatMap((v): unknown[] =>
          Array.isArray(v) ? (v as unknown[]) : [v],
        );
        const fn = p.localFilteringFunction;
        if (!fn) return false;
        const hit = Boolean(
          fn(row as never, values, { valueKey: p.filteredBy! }),
        );
        return filter.type === 'none' ? !hit : hit;
      }),
    );
    return rows;
  };

  return {
    codec: {
      serialize: (state, ctx) => {
        const children = state.filter.children;
        const page =
          state.page.kind === 'offset'
            ? state.page
            : { page: 1, perPage: state.page.size };
        return {
          searchTerm: state.query.term,
          filters: children
            .filter(isRootCondition)
            .filter((node) => !node.disabled)
            .map(nodeToFilter),
          rest: {
            ...state.filter,
            children: children.filter((node) => !isRootCondition(node)),
          },
          sort: state.sort[0],
          page: page.page,
          perPage: page.perPage,
          operators: ctx.operators,
        };
      },
    },

    search: (request, signal) => {
      signal.throwIfAborted();
      let rows = filterRows(request).filter((row) =>
        matches(request.rest, row, { operators: request.operators }),
      );
      const { sort } = request;
      if (sort) {
        const sign = sort.direction === 'desc' ? -1 : 1;
        rows = [...rows].sort(
          (a, b) => sign * compare(get(a, sort.field), get(b, sort.field)),
        );
      }
      const perPage = request.perPage || 20;
      const total = rows.length;
      const results = usePagination
        ? rows.slice((request.page - 1) * perPage, request.page * perPage)
        : rows;
      return Promise.resolve({
        results,
        total,
        pageCount: Math.ceil(total / perPage),
      });
    },

    normalize: (response) => response,
  };
}

// --- the driver ----------------------------------------------------------------------

/**
 * searchUiCompat plus the old LocalSearchDriver API (setData,
 * setProperties, runSearch). If app code checks `instanceof
 * LocalSearchDriver`, export this class under that name.
 */
export class LocalSearchCompat<Doc = unknown> extends SearchUiCompat<Doc> {
  readonly #source: LocalSource<Doc>;

  constructor(
    driver: SearchDriver<Doc>,
    source: LocalSource<Doc>,
    options: SearchUiCompatOptions = {},
  ) {
    super(driver, options);
    this.#source = source;
  }

  get data(): readonly Doc[] {
    return this.#source.data;
  }

  get properties(): readonly LocalSearchInput[] {
    return this.#source.properties;
  }

  /** Replaces the rows and searches again, on the current page. */
  setData = (data: Doc[]): void => {
    this.#source.data = data;
    this.runSearch();
  };

  /** Replaces the properties and searches again, on the current page. */
  setProperties = (properties: LocalSearchInput[]): void => {
    this.#source.properties = properties;
    this.runSearch();
  };

  /** Searches again with the current state. */
  runSearch = (): void => {
    void this.driver.refresh();
  };
}

/** An in-memory driver with the old LocalSearchDriver API and semantics. */
export function localSearch<Doc = unknown>(
  options: LocalSearchOptions<Doc> = {},
): LocalSearchCompat<Doc> {
  const source: LocalSource<Doc> = {
    data: options.data ?? [],
    properties: options.properties ?? [],
  };
  const defaults =
    options.defaults ??
    createState({ page: { kind: 'offset', page: 1, perPage: 10 } });
  const driver = new SearchDriver<Doc>({
    backend: localBackend(source, options),
    initialState: fromSearchUiState(
      options.initialState ?? {},
      defaults,
      options.schema,
    ),
    ...(options.schema ? { schema: options.schema } : {}),
  });
  return new LocalSearchCompat(
    driver,
    source,
    options.arrays ? { arrays: options.arrays } : {},
  );
}
