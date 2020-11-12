import GlimmerComponent from '@glimmer/component';
import EmberObject from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { scheduleOnce } from '@ember/runloop';

/* For a given object execute mapContextToProps to pluck out the relevant
properties */
function giveMeJustWhatINeeded(stateOrContext, mapContextToProps, args) {
  const mapContextToPropsToUse = args.mapContextToProps || mapContextToProps;
  return mapContextToPropsToUse(stateOrContext, args) || {};
}

const template = hbs`
	{{yield this.wantedState}}
`;

class WithSearchComponent extends GlimmerComponent {
  @tracked wantedState = null;
  @tracked driverActions = null;

  constructor() {
    super(...arguments);
    assert(
      'WithSearch requires a function to be provided which returns an object with at least one value',
      this.args.mapContextToProps || this.mapContextToProps
    );
    assert('WithSearch requires a driver', this.args.driver);
    const { driver, mapContextToProps } = this.args;
    this.setup(driver, mapContextToProps);
  }

  setup(driver, mapContextToProps) {
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
		scheduleOnce('afterRender', this, function() {
			this.wantedState.setProperties(newState)
		})
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
	
  willDestroy() {
    this.args.driver.unsubscribeToStateChanges(this.subscription);
  }
}

export default setComponentTemplate(template, WithSearchComponent);
