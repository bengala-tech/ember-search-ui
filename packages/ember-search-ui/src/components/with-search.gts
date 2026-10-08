import Component from '@glimmer/component';
import { assert } from '@ember/debug';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { scheduleOnce } from '@ember/runloop';
import { TrackedObject } from 'tracked-built-ins';
import type Owner from '@ember/owner';
import type { SearchDriver, SearchState } from '@elastic/search-ui';
import type { MapContextToProps } from '../types.ts';

export interface WithSearchSignature<T extends object> {
  Args: {
    driver: SearchDriver;
    mapContextToProps: MapContextToProps<T>;
  };
  Blocks: {
    default: [T];
  };
}

/**
 * Subscribes to a SearchDriver and yields the slice of its state and actions
 * picked by `@mapContextToProps`. The yielded object is one persistent,
 * per-key tracked instance: only the picked keys whose value actually
 * changed are written on each update, so a template reading one key never
 * re-evaluates because a different, unrelated key changed.
 */
export default class WithSearch<T extends object> extends Component<
  WithSearchSignature<T>
> {
  /** Subclasses may provide a default instead of `@mapContextToProps`. */
  declare mapContextToProps?: MapContextToProps<T>;

  private subscribedDriver?: SearchDriver;
  private trackedState?: Record<string, unknown>;
  private pendingState?: SearchState;

  constructor(owner: Owner, args: WithSearchSignature<T>['Args']) {
    super(owner, args);
    assert(
      'WithSearch requires a function to be provided which returns an object with at least one value',
      this.args.mapContextToProps || this.mapContextToProps,
    );
    assert('WithSearch requires a driver', this.args.driver);
    // Subscribe right away so state is tracked even without a block.
    this.subscribe(this.args.driver);
  }

  get wantedState(): T {
    const { driver } = this.args;
    if (driver !== this.subscribedDriver) {
      this.subscribe(driver);
    }
    return this.trackedState as unknown as T;
  }

  private pickWantedProps(
    state: SearchState,
    driver: SearchDriver,
  ): Record<string, unknown> {
    const map = this.args.mapContextToProps || this.mapContextToProps!;
    return (map({ ...state, ...driver.getActions() }, this.args) ||
      {}) as Record<string, unknown>;
  }

  private subscribe(driver: SearchDriver) {
    this.unsubscribe();
    this.subscribedDriver = driver;
    this.trackedState = new TrackedObject<Record<string, unknown>>(
      this.pickWantedProps(driver.getState(), driver),
    );
    driver.subscribeToStateChanges(this.onStateChange);
  }

  private unsubscribe() {
    this.subscribedDriver?.unsubscribeToStateChanges?.(this.onStateChange);
  }

  private onStateChange = (state: SearchState) => {
    this.pendingState = state;
    // Batch driver updates into one re-render after the current render.
    // eslint-disable-next-line ember/no-runloop
    scheduleOnce('afterRender', this, this.applyPendingState);
  };

  private applyPendingState = () => {
    if (isDestroying(this) || isDestroyed(this) || !this.pendingState) return;
    const next = this.pickWantedProps(
      this.pendingState,
      this.subscribedDriver!,
    );
    this.pendingState = undefined;
    this.syncWantedProps(next);
  };

  /**
   * TrackedObject marks a key dirty on every `set`, with no equality
   * check, so skipping writes for unchanged values here is what gives
   * each picked key its own independent invalidation - same guarantee
   * `EmberObject` + `setProperties` gave the previous implementation.
   */
  private syncWantedProps(next: Record<string, unknown>) {
    const target = this.trackedState!;
    for (const key of Object.keys(next)) {
      if (target[key] !== next[key]) {
        target[key] = next[key];
      }
    }
    for (const key of Object.keys(target)) {
      if (!(key in next)) {
        delete target[key];
      }
    }
  }

  willDestroy() {
    super.willDestroy();
    this.unsubscribe();
  }

  <template>{{yield this.wantedState}}</template>
}
