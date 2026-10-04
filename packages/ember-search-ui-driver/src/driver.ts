import type {
  Backend,
  CodecContext,
  FieldSchema,
  StateCodec,
} from './codec.ts';
import { randomIds, type IdFactory } from './ids.ts';
import { invalidConditions } from './normalize.ts';
import { OperatorRegistry, type OperatorDefinition } from './operators.ts';
import { createState, firstPage } from './state.ts';
import {
  ROOT_ID,
  TreeError,
  collectIds,
  findNode,
  insertNode,
  materialize,
  moveNode,
  removeNode,
  updateNode,
  type NodePatch,
} from './tree.ts';
import type {
  FilterNode,
  GroupInput,
  GroupNode,
  NodeId,
  NodeInput,
  SearchResult,
  SearchState,
  SortItem,
  ValidationWarning,
} from './types.ts';

export interface DriverOptions<Doc = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backend: Backend<any, any, Doc>;
  initialState?: Partial<SearchState>;
  operators?: OperatorRegistry | readonly OperatorDefinition[];
  schema?: FieldSchema;
  idFactory?: IdFactory;
  /** Wait this long after the last change before searching. Default 0. */
  debounceMs?: number;
  /** Search as soon as the driver is created. Default true. */
  searchOnInit?: boolean;
}

export interface Snapshot<Doc = unknown> {
  readonly state: SearchState;
  readonly result: SearchResult<Doc>;
}

type Listener<Doc> = (snapshot: Snapshot<Doc>) => void;

const IDLE: SearchResult<never> = {
  status: 'idle',
  results: [],
  total: 0,
  pageCount: 0,
  aggregations: {},
  warnings: [],
};

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

/**
 * Owns one SearchState, changes it only through commands, and runs one
 * search per settled change through its backend.
 */
export class SearchDriver<Doc = unknown> {
  readonly operators: OperatorRegistry;
  readonly idFactory: IdFactory;
  readonly schema: FieldSchema | undefined;
  readonly #backend: DriverOptions<Doc>['backend'];
  readonly #debounceMs: number;

  #snapshot: Snapshot<Doc>;
  #listeners = new Set<Listener<Doc>>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #controller: AbortController | undefined;
  #requestSeq = 0;
  #inFlight: Promise<void> | undefined;
  #transactionDepth = 0;
  #pendingDelay: number | undefined;
  #destroyed = false;
  #settledWaiters: (() => void)[] = [];

  constructor(options: DriverOptions<Doc>) {
    this.#backend = options.backend;
    this.operators =
      options.operators instanceof OperatorRegistry
        ? options.operators
        : new OperatorRegistry(options.operators);
    this.idFactory = options.idFactory ?? randomIds;
    this.schema = options.schema;
    this.#debounceMs = options.debounceMs ?? 0;

    const state = createState(options.initialState);
    if (state.filter.id !== ROOT_ID) {
      throw new TreeError(`The root group's id must be "${ROOT_ID}"`);
    }
    collectIds(state.filter); // throws on duplicate ids
    this.#snapshot = { state, result: IDLE };

    if (options.searchOnInit ?? true) this.#schedule(0);
  }

  // --- reading -----------------------------------------------------------

  get state(): SearchState {
    return this.#snapshot.state;
  }

  get result(): SearchResult<Doc> {
    return this.#snapshot.result;
  }

  /** Changes identity on every state or result change. */
  get snapshot(): Snapshot<Doc> {
    return this.#snapshot;
  }

  get codecContext(): CodecContext {
    return {
      operators: this.operators,
      idFactory: this.idFactory,
      ...(this.schema ? { schema: this.schema } : {}),
    };
  }

  findNode(id: NodeId): FilterNode | undefined {
    return findNode(this.state.filter, id);
  }

  subscribe(listener: Listener<Doc>): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // --- filter tree commands -------------------------------------------------

  /** Adds a node (builder input) under a group; returns the new node's id. */
  add(parentId: NodeId, input: NodeInput, index?: number): NodeId {
    const taken = collectIds(this.state.filter);
    const node = materialize(input, this.idFactory, taken);
    this.#setFilter(insertNode(this.state.filter, parentId, node, index));
    return node.id;
  }

  update(id: NodeId, patch: NodePatch): void {
    this.#setFilter(updateNode(this.state.filter, id, patch));
  }

  remove(id: NodeId): void {
    this.#setFilter(removeNode(this.state.filter, id));
  }

  move(id: NodeId, parentId: NodeId, index?: number): void {
    this.#setFilter(moveNode(this.state.filter, id, parentId, index));
  }

  toggleNegate(id: NodeId): void {
    const node = this.#require(id);
    this.update(id, { negate: node.negate ? undefined : true });
  }

  toggleDisabled(id: NodeId): void {
    const node = this.#require(id);
    this.update(id, { disabled: node.disabled ? undefined : true });
  }

  /** Replaces the whole filter tree; the root keeps the id `root`. */
  replaceFilter(input: GroupInput): void {
    const root = materialize(
      { ...input, id: ROOT_ID },
      this.idFactory,
    ) as GroupNode;
    this.#setFilter(root);
  }

  clearFilter(): void {
    this.#setFilter({ ...this.state.filter, children: [] });
  }

  // --- the rest of the request ----------------------------------------------

  setQuery(term: string, options: { debounceMs?: number } = {}): void {
    this.#commit(
      {
        ...this.state,
        query: { ...this.state.query, term },
        page: firstPage(this.state.page),
      },
      options.debounceMs,
    );
  }

  setSort(sort: readonly SortItem[]): void {
    this.#commit({ ...this.state, sort, page: firstPage(this.state.page) });
  }

  setPage(page: number): void {
    const current = this.state.page;
    if (current.kind !== 'offset') {
      throw new TypeError('setPage needs offset pagination; use setCursor');
    }
    this.#commit({
      ...this.state,
      page: { ...current, page: Math.max(1, page) },
    });
  }

  setCursor(cursor: string | null): void {
    const current = this.state.page;
    if (current.kind !== 'cursor') {
      throw new TypeError('setCursor needs cursor pagination; use setPage');
    }
    this.#commit({ ...this.state, page: { ...current, cursor } });
  }

  setPerPage(perPage: number): void {
    const current = this.state.page;
    const page =
      current.kind === 'offset'
        ? { ...current, page: 1, perPage }
        : { ...current, cursor: null, size: perPage };
    this.#commit({ ...this.state, page });
  }

  setExtension(key: string, value: unknown): void {
    const extensions = { ...this.state.extensions };
    if (value === undefined) delete extensions[key];
    else extensions[key] = value;
    this.#commit({ ...this.state, extensions });
  }

  /** Replaces the whole state (e.g. restored from a URL). */
  setState(state: SearchState): void {
    if (state.filter.id !== ROOT_ID) {
      throw new TreeError(`The root group's id must be "${ROOT_ID}"`);
    }
    collectIds(state.filter);
    this.#commit(state);
  }

  /** Runs many commands; searches once at the end. */
  transaction(fn: (driver: this) => void): void {
    this.#transactionDepth++;
    try {
      fn(this);
    } finally {
      this.#transactionDepth--;
      if (this.#transactionDepth === 0 && this.#pendingDelay !== undefined) {
        const delay = this.#pendingDelay;
        this.#pendingDelay = undefined;
        this.#schedule(delay);
      }
    }
  }

  import<External>(codec: StateCodec<External>, external: External): void {
    if (!codec.parse) throw new TypeError('This codec cannot parse');
    this.setState(codec.parse(external, this.codecContext));
  }

  export<External>(codec: StateCodec<External>): External {
    return codec.serialize(this.state, this.codecContext);
  }

  // --- searching ---------------------------------------------------------------

  /** Searches now, skipping any pending debounce. */
  refresh(): Promise<void> {
    this.#clearTimer();
    return this.#run();
  }

  /** Resolves once no search is scheduled or running. */
  settled(): Promise<void> {
    if (this.#isSettled()) return Promise.resolve();
    return new Promise((resolve) => this.#settledWaiters.push(resolve));
  }

  get isSettled(): boolean {
    return this.#isSettled();
  }

  destroy(): void {
    this.#destroyed = true;
    this.#clearTimer();
    this.#controller?.abort();
    this.#listeners.clear();
    this.#flushSettled();
  }

  // --- internals ---------------------------------------------------------------

  #require(id: NodeId): FilterNode {
    const node = this.findNode(id);
    if (!node) throw new TreeError(`No node with id "${id}"`);
    return node;
  }

  #setFilter(filter: GroupNode): void {
    if (filter === this.state.filter) return;
    this.#commit({ ...this.state, filter, page: firstPage(this.state.page) });
  }

  #commit(state: SearchState, delay = this.#debounceMs): void {
    if (this.#destroyed) return;
    this.#emit({ ...this.#snapshot, state });
    if (this.#transactionDepth > 0) {
      this.#pendingDelay = Math.max(this.#pendingDelay ?? 0, delay);
    } else {
      this.#schedule(delay);
    }
  }

  #schedule(delay: number): void {
    this.#clearTimer();
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.#run();
    }, delay);
  }

  #clearTimer(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }

  #run(): Promise<void> {
    if (this.#destroyed) return Promise.resolve();
    const seq = ++this.#requestSeq;
    this.#controller?.abort();
    const controller = (this.#controller = new AbortController());
    const state = this.state;
    const warnings = invalidConditions(state.filter, this.operators);

    this.#emit({
      state,
      result: { ...this.#snapshot.result, status: 'loading', warnings },
    });

    const run = (async () => {
      try {
        const request: unknown = this.#backend.codec.serialize(
          withInvalidDisabled(state, warnings),
          this.codecContext,
        );
        const response: unknown = await this.#backend.search(
          request,
          controller.signal,
        );
        if (seq !== this.#requestSeq || this.#destroyed) return;
        const normalized = this.#backend.normalize(response, state);
        this.#emit({
          state: this.state,
          result: {
            status: 'success',
            results: normalized.results,
            total: normalized.total,
            pageCount:
              normalized.pageCount ?? pageCount(state, normalized.total),
            aggregations: normalized.aggregations ?? {},
            warnings,
          },
        });
      } catch (error) {
        if (seq !== this.#requestSeq || this.#destroyed || isAbort(error)) {
          return;
        }
        // keep the last good results visible
        this.#emit({
          state: this.state,
          result: {
            ...this.#snapshot.result,
            status: 'error',
            error,
            warnings,
          },
        });
      }
    })();

    this.#inFlight = run;
    void run.finally(() => {
      if (this.#inFlight === run) this.#inFlight = undefined;
      this.#flushSettled();
    });
    return run;
  }

  #isSettled(): boolean {
    return (
      this.#timer === undefined &&
      this.#inFlight === undefined &&
      this.#transactionDepth === 0
    );
  }

  #flushSettled(): void {
    if (!this.#isSettled() && !this.#destroyed) return;
    const waiters = this.#settledWaiters;
    this.#settledWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  #emit(snapshot: Snapshot<Doc>): void {
    this.#snapshot = snapshot;
    for (const listener of [...this.#listeners]) listener(snapshot);
  }
}

function pageCount(state: SearchState, total: number): number {
  return state.page.kind === 'offset'
    ? Math.ceil(total / state.page.perPage)
    : 0;
}

/** The request sees invalid conditions as disabled, so codecs skip them. */
function withInvalidDisabled(
  state: SearchState,
  warnings: readonly ValidationWarning[],
): SearchState {
  if (warnings.length === 0) return state;
  let filter = state.filter;
  for (const { nodeId } of warnings) {
    filter = updateNode(filter, nodeId, { disabled: true });
  }
  return { ...state, filter };
}
