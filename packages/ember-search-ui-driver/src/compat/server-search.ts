import { SearchDriver } from '../driver.ts';
import { createState } from '../state.ts';
import {
  searchApiBackend,
  searchApiCodec,
  type SearchApiCodec,
  type SearchApiCodecOptions,
  type SearchApiRequest,
  type SearchApiResponse,
} from '../codecs/search-api.ts';
import {
  SearchUiCompat,
  fromSearchUiState,
  type SearchUiCompatOptions,
  type SearchUiRequestState,
} from './search-ui.ts';
import type { FieldSchema } from '../codec.ts';
import type { SearchState } from '../types.ts';

// The extras a typical server driver built on search-ui adds, over
// the new driver: `apiConnector` (endpoint, serializeState, prepareRequest,
// makeSearch), `getSerializedState()` and `makeSearch()`. Exports, widgets
// and bulk actions use them to repeat the current search elsewhere: another
// endpoint (`.xlsx`), another page size, extra request options.
//
// The protocol is the old one:
//   serializeState(state)        search-ui state, filters as sent (hooks applied)
//   prepareRequest(serialized)   the request: { search, sort, page, per, filters }
//   makeSearch(endpoint, serialized, extra)   prepares and sends it

/** Sends a request: the app's client (endpoint, request, options). */
export type SearchApiSend = (
  endpoint: string,
  request: SearchApiRequest,
  extra: Record<string, unknown>,
) => Promise<unknown>;

/** search-ui request state with the filters as they are sent. */
export interface SerializedSearchUiState {
  [key: string]: unknown;
  current?: number;
  resultsPerPage?: number;
  searchTerm?: string;
  sortField?: string;
  sortDirection?: string;
  filters: SearchApiRequest['filters'];
}

export interface ApiConnector {
  readonly endpoint: string;
  readonly include: string | undefined;
  serializeState(state: SearchUiRequestState): SerializedSearchUiState;
  prepareRequest(
    state: SerializedSearchUiState,
    extra?: Record<string, unknown>,
  ): SearchApiRequest;
  makeSearch(
    endpoint: string | undefined,
    state: SerializedSearchUiState,
    extra?: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface ServerSearchCompatOptions extends SearchUiCompatOptions {
  endpoint: string;
  send: SearchApiSend;
  /** The codec the driver's backend uses (same filter format and hooks). */
  codec: SearchApiCodec;
  /** JSON:API include, added by makeSearch like the old connector. */
  include?: string;
}

/** searchUiCompat plus the server driver API (apiConnector, makeSearch...). */
export class ServerSearchCompat<Doc = unknown> extends SearchUiCompat<Doc> {
  readonly apiConnector: ApiConnector;
  readonly #codec: SearchApiCodec;

  constructor(driver: SearchDriver<Doc>, options: ServerSearchCompatOptions) {
    super(driver, options);
    this.#codec = options.codec;
    const { endpoint, include, send } = options;

    const prepareRequest = (
      state: SerializedSearchUiState,
      extra: Record<string, unknown> = {},
    ): SearchApiRequest => {
      const request: SearchApiRequest = { ...extra, filters: state.filters };
      if (state.searchTerm) request.search = state.searchTerm;
      if (state.sortField) {
        request.sort = state.sortField;
        request.sort_direction = state.sortDirection === 'asc' ? 'asc' : 'desc';
      }
      if (state.current) request.page = state.current;
      if (state.resultsPerPage !== undefined)
        request.per = state.resultsPerPage;
      return request;
    };

    this.apiConnector = {
      endpoint,
      include,
      serializeState: (state) => this.serializeState(state),
      prepareRequest,
      makeSearch: (target, state, extra = {}) => {
        const request = prepareRequest(state, { include });
        for (const key of Object.keys(request))
          if (request[key] === undefined) delete request[key];
        return send(target || endpoint, request, extra);
      },
    };
  }

  /**
   * A search-ui state with its filters as they are sent. The current state
   * is serialized from the driver itself, so nodes made outside the
   * search-ui filters (a query builder) are included.
   */
  serializeState = (state: SearchUiRequestState): SerializedSearchUiState => {
    const searchState =
      state === this.getState()
        ? this.driver.state
        : this.#toSearchState(state);
    const { filters } = this.#codec.serialize(
      searchState,
      this.driver.codecContext,
    );
    return { ...state, filters };
  };

  /**
   * Calls `listener` with the serialized request state whenever the request
   * changes, what the old beforeSearchCall handed to onSearchStateChange
   * (and apps keep in a `query` param). Returns the unsubscribe function.
   */
  onSerializedStateChange = (
    listener: (state: SerializedSearchUiState) => void,
  ): (() => void) =>
    this.onRequestStateChange((request) =>
      listener(this.serializeState(request)),
    );

  getSerializedState = (): SerializedSearchUiState =>
    this.serializeState(this.getState());

  makeSearch = (
    state: SerializedSearchUiState,
    extra?: Record<string, unknown>,
  ): Promise<unknown> =>
    this.apiConnector.makeSearch(this.apiConnector.endpoint, state, extra);

  /** A search-ui state over the driver's state; its other nodes are kept. */
  #toSearchState(state: SearchUiRequestState): SearchState {
    const current = this.driver.state;
    const others = current.filter.children.filter(
      (node) => node.kind !== 'condition',
    );
    return fromSearchUiState(
      state,
      { ...current, filter: { ...current.filter, children: others } },
      this.driver.schema,
    );
  }
}

export interface ServerSearchOptions
  extends SearchApiCodecOptions, SearchUiCompatOptions {
  endpoint: string;
  /**
   * Sends every request, searches and makeSearch alike. Searches pass
   * `{ signal }` in `extra`; honour it to cancel superseded searches.
   */
  send: SearchApiSend;
  /**
   * Runs on search responses only (not makeSearch), like the old
   * afterSearchCall: push the payload into the store, cap total_pages...
   */
  afterSearch?: (
    response: SearchApiResponse,
  ) => SearchApiResponse | Promise<SearchApiResponse>;
  include?: string;
  /**
   * The search-ui state to start from, e.g. the controller's `query` param.
   * Its filters are serialized (as onSerializedStateChange reports them);
   * `parseValue` reads each value back.
   */
  initialState?: SearchUiRequestState;
  /** Defaults under `initialState`. Default: page 1, 10 per page. */
  defaults?: SearchState;
  schema?: FieldSchema;
  /** Default 0, like search-ui. */
  debounceMs?: number;
  searchOnInit?: boolean;
}

/**
 * A driver for a search API endpoint wrapped in the server driver API:
 * the usual server-driver setup, as one call.
 */
export function serverSearch<Doc = unknown>(
  options: ServerSearchOptions,
): ServerSearchCompat<Doc> {
  const { endpoint, send, afterSearch, include } = options;
  const defaults =
    options.defaults ??
    createState({ page: { kind: 'offset', page: 1, perPage: 10 } });
  const { parseValue } = options;
  const query = options.initialState ?? {};
  const restored: SearchUiRequestState = {
    ...query,
    ...(query.filters && parseValue
      ? {
          filters: query.filters.map((filter) => ({
            ...filter,
            values: filter.values.map((v) => parseValue(filter.field, v)),
          })),
        }
      : {}),
  };
  const initialState = fromSearchUiState(
    restored,
    include === undefined
      ? defaults
      : {
          ...defaults,
          extensions: { ...defaults.extensions, 'api.include': include },
        },
    options.schema,
  );
  const backend = searchApiBackend<Doc>({
    ...options,
    request: async (request, signal) => {
      const response = (await send(endpoint, request, {
        signal,
      })) as SearchApiResponse;
      return afterSearch ? afterSearch(response) : response;
    },
  });
  const driver = new SearchDriver<Doc>({
    backend,
    initialState,
    ...(options.schema ? { schema: options.schema } : {}),
    debounceMs: options.debounceMs ?? 0,
    ...(options.searchOnInit === undefined
      ? {}
      : { searchOnInit: options.searchOnInit }),
  });
  return new ServerSearchCompat(driver, {
    ...(options.arrays ? { arrays: options.arrays } : {}),
    endpoint,
    send,
    codec: searchApiCodec(options),
    ...(include === undefined ? {} : { include }),
  });
}
