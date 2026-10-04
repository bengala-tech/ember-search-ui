import { tracked } from '@glimmer/tracking';
import type { SearchUiRequestState } from 'ember-search-ui-driver';
import type { ServerSearchCompat } from 'ember-search-ui-driver';
import type { Inspection } from '../demo/data.ts';
import ListController from '../example/search-controller.ts';

/**
 * The legacy list controller: the `query` query param holds the serialized
 * search-ui state, written on every request change and read back when the
 * page loads.
 */
export default class LegacyTemplateController extends ListController {
  queryParams = ['query'];
  /** Kept as JSON in the URL. */
  @tracked query: string | null = null;

  protected override initialSearchState(): SearchUiRequestState {
    return this.query ? (JSON.parse(this.query) as SearchUiRequestState) : {};
  }

  protected override createSearchDriver(): ServerSearchCompat<Inspection> {
    const driver = super.createSearchDriver();
    // what onSearchStateChange did with the search-ui driver
    driver.onSerializedStateChange((state) => {
      this.query = JSON.stringify(state);
    });
    return driver;
  }

  /** Code like a calendar's: actions called on the driver itself. */
  onlyPending = () => this.searchDriver.setFilter('state', 'pending', 'any');

  createdInMarch = () =>
    this.searchDriver.setFilter('created_at', {
      gte: new Date('2026-03-01T00:00:00.000Z'),
      lte: new Date('2026-03-31T23:59:59.999Z'),
    });

  clearFilters = () => this.searchDriver.clearFilters();
}
