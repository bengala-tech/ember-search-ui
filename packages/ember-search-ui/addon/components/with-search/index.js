import Component from '@glimmer/component';
import EmberObject from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { scheduleOnce } from '@ember/runloop';
import { helper } from '@ember/component/helper';

/* For a given object execute mapContextToProps to pluck out the relevant
properties */
function giveMeJustWhatINeeded(stateOrContext, mapContextToProps, args) {
  const mapContextToPropsToUse = args.mapContextToProps || mapContextToProps;
  return mapContextToPropsToUse(stateOrContext, args) || {};
}

export default class WithSearchComponent extends Component {
  @tracked wantedState = null;
  @tracked driverActions = null;
  _lastDriver = null;

  setupDriver = helper(function ([driver, mapContextToProps, callback]) {
    return callback(driver, mapContextToProps);
  });

  constructor() {
    super(...arguments);
    assert(
      'WithSearch requires a function to be provided which returns an object with at least one value',
      this.args.mapContextToProps || this.mapContextToProps
    );
    assert('WithSearch requires a driver', this.args.driver);
  }

  @action
  setup(driver, mapContextToProps) {
    if (this._lastDriver === driver) {
      return;
    } else {
      this.unsubscribe();
      this._lastDriver = driver;
    }

    const initialState = driver.getState();
    this.driverActions = driver.getActions();

    this.wantedState = EmberObject.create(
      giveMeJustWhatINeeded(
        {
          ...initialState,
          ...this.driverActions,
        },
        mapContextToProps,
        this.args
      )
    );

    driver.subscribeToStateChanges(this.subscription);
  }

  scheduleStateChange(newState) {
    const update = () => {
      this.wantedState.setProperties(newState);
    };
    scheduleOnce('afterRender', this, update);
  }

  @action
  subscription(state) {
    if (!this.isDestroyed || !this.isDestroying) {
      let newState = giveMeJustWhatINeeded(
        {
          ...this.driverActions,
          ...state,
        },
        this.args.mapContextToProps,
        this.args
      );
      this.scheduleStateChange(newState);
    }
  }

  @action
  unsubscribe() {
    this._lastDriver?.unsubscribeToStateChanges?.(this.subscription);
  }

  willDestroy() {
    super.willDestroy();
    this.unsubscribe();
  }
}
