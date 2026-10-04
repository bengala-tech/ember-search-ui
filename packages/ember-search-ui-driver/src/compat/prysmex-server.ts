import { SearchDriver } from '../driver.ts';
import { createState } from '../state.ts';
import {
  prysmexBackend,
  prysmexCodec,
  type PrysmexCodec,
  type PrysmexCodecOptions,
  type PrysmexRequest,
  type PrysmexResponse,
} from '../codecs/prysmex.ts';
import {
  SearchUiCompat,
  filterNodeId,
  fromSearchUiState,
  type SearchUiRequestState,
} from './search-ui.ts';
import type { FieldSchema } from '../codec.ts';
import type { SearchState } from '../types.ts';

// The extras Prysmex's ServerSearchDriver adds to search-ui's driver, over
// the new driver: `apiConnector` (endpoint, serializeState, prepareRequest,
// makeSearch), `getSerializedState()` and `makeSearch()`. Exports, widgets
// and bulk actions use them to repeat the current search elsewhere: another
// endpoint (`.xlsx`), another page size, extra request options.
//
// The protocol is the old one:
//   serializeState(state)        search-ui state, filters as sent (hooks applied)
//   prepareRequest(serialized)   the request: { search, sort, page, per, filters }
//   makeSearch(endpoint, serialized, extra)   prepares and sends it

/** Sends a request: Prysmex's client.request (endpoint, query, options). */
export type PrysmexSend = (
  endpoint: string,
  request: PrysmexRequest,
  extra: Record<string, unknown>,
) => Promise<unknown>;

/** search-ui request state with the filters as they are sent. */
export interface PrysmexSerializedState {
  [key: string]: unknown;
  current?: number;
  resultsPerPage?: number;
  searchTerm?: string;
  sortField?: string;
  sortDirection?: string;
  filters: PrysmexRequest['filters'];
}

export interface PrysmexApiConnector {
  readonly endpoint: string;
  readonly include: string | undefined;
  serializeState(state: SearchUiRequestState): PrysmexSerializedState;
  prepareRequest(
    state: PrysmexSerializedState,
    extra?: Record<string, unknown>,
  ): PrysmexRequest;
  makeSearch(
    endpoint: string | undefined,
    state: PrysmexSerializedState,
    extra?: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface PrysmexServerCompatOptions {
  endpoint: string;
  send: PrysmexSend;
  /** The codec the driver's backend uses (same filter format and hooks). */
  codec: PrysmexCodec;
  /** JSON:API include, added by makeSearch like the old connector. */
  include?: string;
}

/** searchUiCompat plus Prysmex's ServerSearchDriver API. */
export class PrysmexServerCompat<Doc = unknown> extends SearchUiCompat<Doc> {
  readonly apiConnector: PrysmexApiConnector;
  readonly #codec: PrysmexCodec;

  constructor(driver: SearchDriver<Doc>, options: PrysmexServerCompatOptions) {
    super(driver);
    this.#codec = options.codec;
    const { endpoint, include, send } = options;

    const prepareRequest = (
      state: PrysmexSerializedState,
      extra: Record<string, unknown> = {},
    ): PrysmexRequest => {
      const request: PrysmexRequest = { ...extra, filters: state.filters };
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
  serializeState = (state: SearchUiRequestState): PrysmexSerializedState => {
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
   * (and Prysmex keeps in the `query` param). Returns the unsubscribe function.
   */
  onSerializedStateChange = (
    listener: (state: PrysmexSerializedState) => void,
  ): (() => void) =>
    this.onRequestStateChange((request) =>
      listener(this.serializeState(request)),
    );

  getSerializedState = (): PrysmexSerializedState =>
    this.serializeState(this.getState());

  makeSearch = (
    state: PrysmexSerializedState,
    extra?: Record<string, unknown>,
  ): Promise<unknown> =>
    this.apiConnector.makeSearch(this.apiConnector.endpoint, state, extra);

  /** A search-ui state over the driver's state; its other nodes are kept. */
  #toSearchState(state: SearchUiRequestState): SearchState {
    const current = this.driver.state;
    const others = current.filter.children.filter(
      (node) => !node.id.startsWith(filterNodeId('')),
    );
    return fromSearchUiState(
      state,
      { ...current, filter: { ...current.filter, children: others } },
      this.driver.schema,
    );
  }
}

export interface PrysmexServerSearchOptions extends PrysmexCodecOptions {
  endpoint: string;
  /**
   * Sends every request, searches and makeSearch alike. Searches pass
   * `{ signal }` in `extra`; honour it to cancel superseded searches.
   */
  send: PrysmexSend;
  /**
   * Runs on search responses only (not makeSearch), like the old
   * afterSearchCall: push the payload into the store, cap total_pages...
   */
  afterSearch?: (
    response: PrysmexResponse,
  ) => PrysmexResponse | Promise<PrysmexResponse>;
  include?: string;
  /**
   * The search-ui state to start from, e.g. the controller's `query` param.
   * Its filters are serialized (as onSerializedStateChange reports them);
   * `parseValue` reads each value back, like deserializeFilters.
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
 * A driver for a Prysmex endpoint wrapped in the ServerSearchDriver API:
 * what SearchDriverServerHelper builds, as one call.
 */
export function prysmexServerSearch<Doc = unknown>(
  options: PrysmexServerSearchOptions,
): PrysmexServerCompat<Doc> {
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
          extensions: { ...defaults.extensions, 'prysmex.include': include },
        },
    options.schema,
  );
  const backend = prysmexBackend<Doc>({
    ...options,
    request: async (request, signal) => {
      const response = (await send(endpoint, request, {
        signal,
      })) as PrysmexResponse;
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
  return new PrysmexServerCompat(driver, {
    endpoint,
    send,
    codec: prysmexCodec(options),
    ...(include === undefined ? {} : { include }),
  });
}
