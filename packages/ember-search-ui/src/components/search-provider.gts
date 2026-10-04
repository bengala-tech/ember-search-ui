import Component from '@glimmer/component';
import { SearchDriver, type SearchDriverOptions } from '@elastic/search-ui';
import type { SearchProviderConfig } from '../types.ts';

declare const FastBoot: unknown;

const defaultA11yMessages = {
  moreFilters: ({
    visibleOptionsCount,
    showingAll,
  }: {
    visibleOptionsCount: number;
    showingAll: boolean;
  }) => {
    let message = showingAll ? 'All ' : '';
    message += `${visibleOptionsCount} options shown.`;
    return message;
  },
};

export const setupDriver = (
  config: SearchProviderConfig = {},
  driver?: SearchDriver,
): SearchDriver | undefined => {
  if (typeof FastBoot === 'undefined') {
    const currentDriver =
      driver ||
      new SearchDriver({
        ...config,
        a11yNotificationMessages: {
          ...defaultA11yMessages,
          ...config.a11yNotificationMessages,
        },
      } as SearchDriverOptions);
    return currentDriver;
  }
};

export interface SearchProviderSignature {
  Args: {
    config?: SearchProviderConfig;
    driver?: SearchDriver;
  };
  Blocks: {
    default: [SearchDriver];
  };
}

type QueryKey = 'searchQuery' | 'autocompleteQuery';

/**
 * Creates (or adopts `@driver`) a SearchDriver and yields it. Changes to
 * `@config.searchQuery` / `@config.autocompleteQuery` are pushed to the driver.
 */
export default class SearchProvider extends Component<SearchProviderSignature> {
  _driver?: SearchDriver = undefined;
  _lastSearchQuery?: SearchProviderConfig['searchQuery'] = undefined;
  _lastAutocompleteQuery?: SearchProviderConfig['autocompleteQuery'] =
    undefined;

  // The driver is created lazily and @config query changes are pushed to it
  // when read, as in the classic version.
  /* eslint-disable ember/no-side-effects */
  get driver(): SearchDriver | undefined {
    const { config } = this.args;

    if (!this._driver) {
      this._driver = setupDriver(config, this.args.driver);
      this.saveQuery(config);

      return this._driver;
    }

    if (this.configChanged(config, 'searchQuery', this._lastSearchQuery)) {
      this._lastSearchQuery = config!.searchQuery;
      this._driver.setSearchQuery(config!.searchQuery!);
    }

    if (
      this.configChanged(
        config,
        'autocompleteQuery',
        this._lastAutocompleteQuery,
      )
    ) {
      this._lastAutocompleteQuery = config!.autocompleteQuery;
      this._driver.setAutocompleteQuery(config!.autocompleteQuery!);
    }

    return this._driver;
  }
  /* eslint-enable ember/no-side-effects */

  configChanged(
    config: SearchProviderConfig = {},
    configKey: QueryKey,
    last: unknown,
  ): boolean {
    return !!config?.[configKey] && config[configKey] !== last;
  }

  saveQuery({ searchQuery, autocompleteQuery }: SearchProviderConfig = {}) {
    this._lastSearchQuery = searchQuery;
    this._lastAutocompleteQuery = autocompleteQuery;
  }

  willDestroy() {
    super.willDestroy();
    this._driver?.tearDown();
  }

  <template>
    {{#if this.driver}}
      {{yield this.driver}}
    {{/if}}
  </template>
}
