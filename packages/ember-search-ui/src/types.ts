import type {
  SearchContextState,
  SearchDriver as SearchUiDriver,
  SearchDriverOptions,
  SortDirection,
} from '@elastic/search-ui';
import type { SearchUiCompat } from 'ember-search-ui-driver';

export type { SearchContextState, SearchUiDriver };

/**
 * A driver that WithSearch and the containers read: @elastic/search-ui's
 * SearchDriver, or ember-search-ui-driver's search-ui compatible API
 * (`searchUiCompat`, `serverSearch`, `localSearch`), which has the same
 * getState, getActions and subscribeToStateChanges.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SearchDriver = SearchUiDriver | SearchUiCompat<any>;

/**
 * Plucks the slice of driver state + actions a component needs. The second
 * argument is the args of the WithSearch invocation.
 */
export type MapContextToProps<T> = (
  context: SearchContextState,
  args?: object,
) => T;

/** A sort option as passed to `<Sorting @sortOptions>`. */
export interface SortingOption {
  name: string;
  value: string;
  direction: SortDirection;
}

/** A sort option formatted for a select view. */
export interface SelectOption {
  label: string;
  value: string;
}

/**
 * Options for the SearchDriver created by `<SearchProvider @config>`.
 * `apiConnector` is optional because `onSearch`/`onAutocomplete` hooks can
 * be used instead.
 */
export type SearchProviderConfig = Omit<SearchDriverOptions, 'apiConnector'> &
  Partial<Pick<SearchDriverOptions, 'apiConnector'>>;
