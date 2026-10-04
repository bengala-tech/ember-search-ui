import type { SearchDriver } from '@elastic/search-ui';
import type { SearchUiCompat } from 'ember-search-ui-driver';

/**
 * The ember-search-ui containers are typed for @elastic/search-ui's driver.
 * The compat object has the same API but is another class, so TypeScript
 * needs this one cast wherever code is typed against search-ui's driver.
 */
export const asSearchUiDriver = (
  driver: SearchUiCompat<never> | SearchUiCompat<unknown>,
) => driver as unknown as SearchDriver;
