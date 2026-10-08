import Component from '@glimmer/component';
import { registerDestructor } from '@ember/destroyable';
import type Owner from '@ember/owner';
import {
  SearchDriver,
  syncUrl,
  type DriverOptions,
  type UrlSyncOptions,
} from 'ember-search-ui-driver';
import { TrackedSearch } from '../tracked-search.ts';

export interface SearchConfig<Doc = unknown> extends Omit<
  DriverOptions<Doc>,
  'backend'
> {
  /** Required when <Search> creates the driver. */
  backend?: DriverOptions<Doc>['backend'];
  /** URL synchronization is off by default. */
  syncUrl?: boolean | UrlSyncOptions;
}

export interface SearchSignature<Doc = unknown> {
  Args: {
    /** Use this driver; the component never destroys it. */
    driver?: SearchDriver<Doc>;
    /** Driver settings and URL synchronization. Read once per connection. */
    config?: SearchConfig<Doc>;
  };
  Blocks: {
    default: [TrackedSearch<Doc>];
  };
}

/**
 * Yields a TrackedSearch: `state`, `result`, `results`, `isLoading`, `filter`,
 * `node(id)` and the `driver` for commands. Everything it yields is tracked.
 *
 *   <Search @config={{this.config}} as |search|>
 *     {{search.total}} results
 *     <button {{on "click" (fn search.driver.clearFilter)}}>Clear</button>
 *   </Search>
 */
export default class Search<Doc = unknown> extends Component<
  SearchSignature<Doc>
> {
  #search?: TrackedSearch<Doc>;
  #driver?: SearchDriver<Doc>;
  #ownedDriver?: SearchDriver<Doc>;
  #stopUrlSync?: () => void;

  constructor(owner: Owner, args: SearchSignature<Doc>['Args']) {
    super(owner, args);
    if (!args.driver) {
      if (!args.config?.backend) {
        throw new Error('<Search> needs @driver or @config with a backend');
      }
      this.#ownedDriver = new SearchDriver<Doc>({
        ...args.config,
        backend: args.config.backend,
      });
    }
    registerDestructor(this, () => {
      this.#teardown();
      this.#ownedDriver?.destroy();
    });
  }

  // Connects lazily, and reconnects when a different @driver is passed.
  /* eslint-disable ember/no-side-effects */
  get search(): TrackedSearch<Doc> {
    const driver = this.args.driver ?? this.#ownedDriver!;
    if (driver !== this.#driver) {
      // a new @driver: reconnect
      this.#teardown();
      this.#driver = driver;
      // restore from the URL first, so the first snapshot already has it
      const sync = this.args.config?.syncUrl ?? false;
      if (sync) {
        this.#stopUrlSync = syncUrl(driver, sync === true ? {} : sync);
      }
      this.#search = new TrackedSearch(driver);
    }
    return this.#search!;
  }
  /* eslint-enable ember/no-side-effects */

  #teardown() {
    this.#stopUrlSync?.();
    this.#stopUrlSync = undefined;
    this.#search?.disconnect();
  }

  <template>{{yield this.search}}</template>
}
