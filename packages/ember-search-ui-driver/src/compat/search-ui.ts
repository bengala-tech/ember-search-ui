import { isDateValue } from '../operators.ts';
import { createState, DEFAULT_PER_PAGE } from '../state.ts';
import { ROOT_ID } from '../tree.ts';
import type { FieldSchema } from '../codec.ts';
import type { SearchDriver } from '../driver.ts';
import type {
  ConditionNode,
  FilterNode,
  FilterValue,
  GroupNode,
  RangeValue,
  Scalar,
  SearchState,
} from '../types.ts';

// The @elastic/search-ui driver API (getState, getActions, subscribe...)
// over a SearchDriver, so code written for search-ui keeps working:
// ember-search-ui's WithSearch and containers, and apps like Prysmex.
//
// search-ui filters are one entry per field: { field, values, type }. They
// map onto field-owned nodes with the id `filter:<field>` under the root.
// Nodes made some other way (a query builder) are left alone by these
// actions and are not listed in `state.filters`.

export type SearchUiFilterType = 'any' | 'all' | 'none';

export interface SearchUiFilter {
  field: string;
  values: unknown[];
  type: SearchUiFilterType;
}

/** The parts of search-ui's request state that map onto SearchState. */
export interface SearchUiRequestState {
  current?: number;
  resultsPerPage?: number;
  searchTerm?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc' | '';
  filters?: {
    field: string;
    values: unknown[];
    /** `any`, `all` or `none`; anything else reads as `any`. */
    type?: string;
  }[];
}

export interface SearchUiState extends Required<
  Omit<SearchUiRequestState, 'filters'>
> {
  filters: SearchUiFilter[];
  sortList: { field: string; direction: 'asc' | 'desc' }[];
  results: unknown[];
  totalResults: number;
  totalPages: number;
  pagingStart: number;
  pagingEnd: number;
  resultSearchTerm: string;
  wasSearched: boolean;
  isLoading: boolean;
  error: string;
  rawResponse: unknown;
  requestId: string;
  facets: Record<string, unknown>;
  autocompletedResults: unknown[];
  autocompletedResultsRequestId: string;
  autocompletedSuggestions: Record<string, unknown>;
  autocompletedSuggestionsRequestId: string;
}

type Listener = (state: SearchUiState) => void;

const FILTER_PREFIX = 'filter:';
export const filterNodeId = (field: string) => `${FILTER_PREFIX}${field}`;
const isFilterNode = (node: FilterNode): node is ConditionNode =>
  node.kind === 'condition' && node.id.startsWith(FILTER_PREFIX);

const RANGE_KEYS = ['gt', 'gte', 'lt', 'lte'];
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A search-ui filter (field + values + type) as a condition node. With a
 * schema, a string on a text field means "contains" (as Prysmex reads it).
 */
export function filterToNode(
  filter: {
    field: string;
    values: unknown[];
    type?: string;
  },
  schema?: FieldSchema,
): ConditionNode | undefined {
  const values = filter.values.flatMap((v) =>
    Array.isArray(v) ? (v as unknown[]) : [v],
  );
  if (values.length === 0) return undefined;
  const base = {
    kind: 'condition' as const,
    id: filterNodeId(filter.field),
    field: filter.field,
  };
  const negate = filter.type === 'none' ? { negate: true } : {};

  if (values.length === 1) {
    const value = values[0];
    if (isPlainObject(value) && !isDateValue(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === 'exists') {
        return {
          ...base,
          ...negate,
          operator: 'exists',
          value: Boolean(value['exists']),
        };
      }
      if (keys.length && keys.every((k) => RANGE_KEYS.includes(k))) {
        return {
          ...base,
          ...negate,
          operator: 'range',
          value: value as RangeValue,
        };
      }
      if ('from' in value || 'to' in value) {
        // search-ui range facets: from is inclusive, to exclusive
        const range: Record<string, unknown> = {};
        if (value['from'] !== undefined) range['gte'] = value['from'];
        if (value['to'] !== undefined) range['lt'] = value['to'];
        return {
          ...base,
          ...negate,
          operator: 'range',
          value: range as RangeValue,
          meta: { name: value['name'] },
        };
      }
    }
    const textual =
      schema?.[filter.field]?.type === 'text' && typeof value === 'string';
    return {
      ...base,
      ...negate,
      operator: textual ? 'contains' : 'eq',
      value: value as FilterValue,
    };
  }
  return {
    ...base,
    ...negate,
    operator: filter.type === 'all' ? 'all' : 'in',
    value: values as Scalar[],
  };
}

const toWire = (value: unknown) =>
  isDateValue(value) ? ('date' in value ? value.date : value.dateMath) : value;

/** A field-owned node back as a search-ui filter. */
export function nodeToFilter(node: ConditionNode): SearchUiFilter {
  const type: SearchUiFilterType = node.negate
    ? 'none'
    : node.operator === 'all'
      ? 'all'
      : 'any';
  let values: unknown[];
  switch (node.operator) {
    case 'in':
    case 'all':
      values = (node.value as unknown[]).map(toWire);
      break;
    case 'range': {
      const range: Record<string, unknown> = {};
      for (const [key, bound] of Object.entries(node.value as RangeValue))
        range[key] = toWire(bound);
      values = [range];
      break;
    }
    case 'exists':
      values = [{ exists: node.value }];
      break;
    default:
      values = [toWire(node.value)];
  }
  return { field: node.field, values, type };
}

/** A search-ui request state (e.g. from a query param) as SearchState. */
export function fromSearchUiState(
  request: SearchUiRequestState,
  defaults: SearchState = createState(),
  schema?: FieldSchema,
): SearchState {
  const perPage =
    request.resultsPerPage ??
    (defaults.page.kind === 'offset'
      ? defaults.page.perPage
      : DEFAULT_PER_PAGE);
  const filterNodes = (request.filters ?? [])
    .map((filter) => filterToNode(filter, schema))
    .filter((n): n is ConditionNode => n !== undefined);
  return {
    ...defaults,
    query: {
      ...defaults.query,
      term: request.searchTerm ?? defaults.query.term,
    },
    filter: {
      ...defaults.filter,
      children: [...defaults.filter.children, ...filterNodes],
    },
    sort: request.sortField
      ? [
          {
            field: request.sortField,
            direction: request.sortDirection === 'asc' ? 'asc' : 'desc',
          },
        ]
      : defaults.sort,
    page: {
      kind: 'offset',
      page: Number(request.current ?? 1),
      perPage: Number(perPage),
    },
  };
}

/**
 * search-ui's driver API over a SearchDriver. Pass it wherever a search-ui
 * driver is expected (ember-search-ui's WithSearch, containers, app code).
 */
export class SearchUiCompat<Doc = unknown> {
  readonly driver: SearchDriver<Doc>;
  readonly #listeners = new Map<Listener, () => void>();
  #cache?: { snapshot: unknown; state: SearchUiState };
  #wasSearched = false;

  constructor(driver: SearchDriver<Doc>) {
    this.driver = driver;
  }

  get state(): SearchUiState {
    return this.getState();
  }

  getState = (): SearchUiState => {
    const snapshot = this.driver.snapshot;
    if (this.#cache?.snapshot === snapshot) return this.#cache.state;

    const { state, result } = snapshot;
    if (result.status === 'success' || result.status === 'error')
      this.#wasSearched = true;
    const page =
      state.page.kind === 'offset'
        ? state.page
        : { page: 1, perPage: state.page.size };
    const sort = state.sort[0];
    const pagingStart =
      result.total === 0 ? 0 : (page.page - 1) * page.perPage + 1;
    const searchUi: SearchUiState = {
      current: page.page,
      resultsPerPage: page.perPage,
      searchTerm: state.query.term,
      sortField: sort?.field ?? '',
      sortDirection: sort?.direction ?? '',
      sortList: [...state.sort],
      filters: state.filter.children.filter(isFilterNode).map(nodeToFilter),
      results: [...result.results],
      totalResults: result.total,
      totalPages: result.pageCount,
      pagingStart,
      pagingEnd: Math.min(result.total, pagingStart + page.perPage - 1),
      resultSearchTerm: state.query.term,
      wasSearched: this.#wasSearched,
      isLoading: result.status === 'loading',
      error: result.status === 'error' ? errorMessage(result.error) : '',
      rawResponse: result.response,
      requestId: '',
      facets:
        (result.aggregations['facets'] as
          Record<string, unknown> | undefined) ?? {},
      autocompletedResults: [],
      autocompletedResultsRequestId: '',
      autocompletedSuggestions: {},
      autocompletedSuggestionsRequestId: '',
    };
    this.#cache = { snapshot, state: searchUi };
    return searchUi;
  };

  readonly actions = {
    setCurrent: (current: number) => this.driver.setPage(current),

    setResultsPerPage: (perPage: number) => this.driver.setPerPage(perPage),

    setSearchTerm: (
      term: string,
      options: {
        debounce?: number;
        shouldClearFilters?: boolean;
        refresh?: boolean;
      } = {},
    ) => {
      this.driver.transaction(() => {
        if (options.shouldClearFilters ?? true) this.actions.clearFilters();
        this.driver.setQuery(
          term,
          options.debounce ? { debounceMs: options.debounce } : {},
        );
      });
    },

    setSort: (
      sortField: string | { field: string; direction: 'asc' | 'desc' }[] | null,
      sortDirection?: 'asc' | 'desc' | '',
    ) => {
      if (Array.isArray(sortField)) this.driver.setSort(sortField);
      else if (sortField) {
        this.driver.setSort([
          {
            field: sortField,
            direction: sortDirection === 'asc' ? 'asc' : 'desc',
          },
        ]);
      } else this.driver.setSort([]);
    },

    /** Replaces the field's filter. A blank value (null, '', []) removes it. */
    setFilter: (
      field: string,
      value: unknown,
      type: SearchUiFilterType = 'all',
    ) => {
      this.#replace(
        field,
        isBlank(value)
          ? undefined
          : filterToNode({ field, values: [value], type }, this.driver.schema),
      );
    },

    /** Adds a value to the field's filter. */
    addFilter: (
      field: string,
      value: unknown,
      type: SearchUiFilterType = 'all',
    ) => {
      const current = this.#filter(field);
      const values = current ? nodeToFilter(current).values : [];
      if (!values.some((v) => sameValue(v, value))) values.push(value);
      this.#replace(
        field,
        filterToNode({ field, values, type }, this.driver.schema),
      );
    },

    /** Removes one value from the field's filter, or the whole filter. */
    removeFilter: (
      field: string,
      value?: unknown,
      _type?: SearchUiFilterType,
    ) => {
      const current = this.#filter(field);
      if (!current) return;
      if (value === undefined) {
        this.#replace(field, undefined);
        return;
      }
      const filter = nodeToFilter(current);
      const values = filter.values.filter((v) => !sameValue(v, value));
      this.#replace(
        field,
        filterToNode({ field, values, type: filter.type }, this.driver.schema),
      );
    },

    /** Removes every field filter except those for `except` fields. */
    clearFilters: (except: string[] = []) => {
      const keep = new Set(except.map(filterNodeId));
      this.driver.transaction(() => {
        for (const node of this.driver.state.filter.children) {
          if (isFilterNode(node) && !keep.has(node.id))
            this.driver.remove(node.id);
        }
      });
    },

    reset: () => {
      this.driver.transaction(() => {
        this.actions.clearFilters();
        this.driver.setQuery('');
        this.driver.setSort([]);
        this.driver.setPage(1);
      });
    },

    // search-ui analytics hooks: no-ops
    trackClickThrough: (_documentId?: string, _tags?: string[]) => {},
    trackAutocompleteClickThrough: (
      _documentId?: string,
      _tags?: string[],
    ) => {},
    trackAutocompleteSuggestionClickThrough: () => {},
    a11yNotify: (_name?: string, _args?: unknown) => {},
  };

  getActions = () => this.actions;

  subscribeToStateChanges = (listener: Listener): void => {
    if (this.#listeners.has(listener)) return;
    this.#listeners.set(
      listener,
      this.driver.subscribe(() => listener(this.getState())),
    );
  };

  unsubscribeToStateChanges = (listener: Listener): void => {
    this.#listeners.get(listener)?.();
    this.#listeners.delete(listener);
  };

  /**
   * Calls `listener` with the request part of the state (page, size, term,
   * sort, filters) whenever it changes; result updates do not count. What
   * search-ui apps keep in the URL. Returns the unsubscribe function.
   */
  onRequestStateChange = (
    listener: (request: Required<SearchUiRequestState>) => void,
  ): (() => void) => {
    let last = this.driver.state;
    return this.driver.subscribe(({ state }) => {
      if (state === last) return;
      last = state;
      const {
        current,
        resultsPerPage,
        searchTerm,
        sortField,
        sortDirection,
        filters,
      } = this.getState();
      listener({
        current,
        resultsPerPage,
        searchTerm,
        sortField,
        sortDirection,
        filters,
      });
    });
  };

  tearDown = (): void => {
    for (const unsubscribe of this.#listeners.values()) unsubscribe();
    this.#listeners.clear();
    this.driver.destroy();
  };

  // search-ui configuration hooks with no equivalent; kept so callers do not break
  setSearchQuery = (_query: unknown): void => {};
  setAutocompleteQuery = (_query: unknown): void => {};

  #filter(field: string): ConditionNode | undefined {
    const node = this.driver.findNode(filterNodeId(field));
    return node?.kind === 'condition' ? node : undefined;
  }

  #replace(field: string, node: ConditionNode | undefined): void {
    const id = filterNodeId(field);
    const root: GroupNode = this.driver.state.filter;
    const index = root.children.findIndex((child) => child.id === id);
    this.driver.transaction(() => {
      if (index !== -1) this.driver.remove(id);
      if (node)
        this.driver.add(ROOT_ID, node, index === -1 ? undefined : index);
    });
  }
}

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

function errorMessage(error: unknown): string {
  if (error instanceof Error)
    return `An unexpected error occurred: ${error.message}`;
  return typeof error === 'string' && error
    ? error
    : 'An unexpected error occurred';
}

/** Wraps a driver in search-ui's API. */
export const searchUiCompat = <Doc>(driver: SearchDriver<Doc>) =>
  new SearchUiCompat(driver);
