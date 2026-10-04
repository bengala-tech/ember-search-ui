import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { assert } from '@ember/debug';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { scheduleOnce } from '@ember/runloop';
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
 * picked by `@mapContextToProps`. State changes are applied after render.
 */
export default class WithSearch<T extends object> extends Component<
  WithSearchSignature<T>
> {
  /** Subclasses may provide a default instead of `@mapContextToProps`. */
  declare mapContextToProps?: MapContextToProps<T>;

  @tracked private version = 0;
  private subscribedDriver?: SearchDriver;
  private state?: SearchState;
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
    // Re-run whenever the driver pushes new state.
    void this.version;

    const { driver } = this.args;
    if (driver !== this.subscribedDriver) {
      this.subscribe(driver);
    }

    const map = this.args.mapContextToProps || this.mapContextToProps;
    return (
      map({ ...this.state!, ...driver.getActions() }, this.args) || ({} as T)
    );
  }

  private subscribe(driver: SearchDriver) {
    this.unsubscribe();
    this.subscribedDriver = driver;
    this.state = driver.getState();
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
    this.state = this.pendingState;
    this.pendingState = undefined;
    this.version++;
  };

  willDestroy() {
    super.willDestroy();
    this.unsubscribe();
  }

  <template>{{yield this.wantedState}}</template>
}
