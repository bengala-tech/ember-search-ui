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

type DriverConfig<Doc> = Omit<DriverOptions<Doc>, 'backend'>;

export interface SearchSignature<Doc = unknown> {
  Args: {
    /** Use this driver; the component never destroys it. */
    driver?: SearchDriver<Doc>;
    /** Or create (and own) a driver for this backend. Read once. */
    backend?: DriverOptions<Doc>['backend'];
    /** Options for the driver created from `@backend`. Read once. */
    options?: DriverConfig<Doc>;
    /** Keep the state in the URL; `true` or options for `syncUrl`. Read once. */
    syncUrl?: boolean | UrlSyncOptions;
  };
  Blocks: {
    default: [TrackedSearch<Doc>];
  };
}

/**
 * Yields a TrackedSearch: `state`, `result`, `results`, `isLoading`, `filter`,
 * `node(id)` and the `driver` for commands. Everything it yields is tracked.
 *
 *   <Search @backend={{this.backend}} @syncUrl={{true}} as |search|>
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
      if (!args.backend) {
        throw new Error('<Search> needs @driver or @backend');
      }
      this.#ownedDriver = new SearchDriver<Doc>({
        ...args.options,
        backend: args.backend,
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
      const sync = this.args.syncUrl;
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
