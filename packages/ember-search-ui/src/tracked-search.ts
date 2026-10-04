import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { buildWaiter } from '@ember/test-waiters';
import {
  findNode,
  type FilterNode,
  type GroupNode,
  type NodeId,
  type SearchDriver,
  type SearchResult,
  type SearchState,
  type Snapshot,
} from 'ember-search-ui-driver';

const waiter = buildWaiter('ember-search-ui:search');

/**
 * The driver's snapshot in one tracked field. Anything that reads `state`,
 * `result` or a node re-renders when the driver changes. Hooks into the
 * driver only through `subscribe`.
 *
 * Searches are registered with @ember/test-waiters, so `await settled()` in
 * tests waits for them.
 */
export class TrackedSearch<Doc = unknown> {
  @tracked snapshot: Snapshot<Doc>;
  readonly driver: SearchDriver<Doc>;
  readonly #unsubscribe: () => void;
  #waiterToken: unknown;

  constructor(driver: SearchDriver<Doc>) {
    this.driver = driver;
    this.snapshot = driver.snapshot;
    this.#unsubscribe = driver.subscribe((snapshot) => {
      this.snapshot = snapshot;
      this.#trackPending();
    });
    this.#trackPending();
  }

  get state(): SearchState {
    return this.snapshot.state;
  }

  get result(): SearchResult<Doc> {
    return this.snapshot.result;
  }

  get results(): readonly Doc[] {
    return this.snapshot.result.results;
  }

  get total(): number {
    return this.snapshot.result.total;
  }

  get isLoading(): boolean {
    return this.snapshot.result.status === 'loading';
  }

  get filter(): GroupNode {
    return this.snapshot.state.filter;
  }

  /**
   * A node of the current filter tree, tracked like everything else. An arrow
   * function, so templates can call it: `(search.node "my-id")`.
   */
  node = (id: NodeId): FilterNode | undefined =>
    findNode(this.snapshot.state.filter, id);

  /** Stops listening; does not destroy the driver. */
  disconnect(): void {
    this.#unsubscribe();
    this.#endWaiter();
  }

  #trackPending(): void {
    if (this.driver.isSettled || this.#waiterToken) return;
    const token = (this.#waiterToken = waiter.beginAsync());
    void this.driver.settled().then(() => {
      if (this.#waiterToken !== token) return;
      this.#endWaiter();
      this.#trackPending(); // a new change may have started meanwhile
    });
  }

  #endWaiter(): void {
    if (this.#waiterToken) {
      waiter.endAsync(this.#waiterToken);
      this.#waiterToken = undefined;
    }
  }
}

/**
 * A TrackedSearch tied to the lifetime of `owner` (a component, service, ...):
 *
 *   search = trackSearch(this, driver);
 *
 * Pass `{ destroyDriver: true }` when `owner` also owns the driver.
 */
export function trackSearch<Doc>(
  owner: object,
  driver: SearchDriver<Doc>,
  options: { destroyDriver?: boolean } = {},
): TrackedSearch<Doc> {
  const search = new TrackedSearch(driver);
  registerDestructor(owner, () => {
    search.disconnect();
    if (options.destroyDriver) driver.destroy();
  });
  return search;
}
