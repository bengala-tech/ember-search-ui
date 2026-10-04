import Controller from '@ember/controller';
import { serverSearch, type ServerSearchCompat } from 'ember-search-ui-driver';
import { FIELDS, type Inspection } from '../demo/data.ts';
import { NetworkLog } from '../demo/fake-server.ts';
import { fakeSend } from './send.ts';

/**
 * A list controller of an app built on a search-ui server driver: it owns
 * the driver and some actions that reuse the current search (an export).
 * Only `createSearchDriver` changes for the new driver; the templates and
 * the rest of the controller stay as they were.
 */
export default class ListController extends Controller {
  /** The `filters` format the backend accepts. */
  filters: 'list' | 'groups' = 'list';
  endpoint = 'api/inspections/search';
  readonly log = new NetworkLog();
  #driver?: ServerSearchCompat<Inspection>;

  /**
   * The driver, created on first use so it reads the query param after
   * the router has set it.
   */
  get searchDriver(): ServerSearchCompat<Inspection> {
    // the cache is not tracked: creating the driver changes nothing rendered
    // eslint-disable-next-line ember/no-side-effects
    return (this.#driver ??= this.createSearchDriver());
  }

  /** Where the app used to build its search-ui driver and connector. */
  protected createSearchDriver(): ServerSearchCompat<Inspection> {
    return serverSearch<Inspection>({
      endpoint: this.endpoint,
      filters: this.filters,
      schema: FIELDS,
      initialState: this.initialSearchState(),
      send: fakeSend(this.log),
      // e.g. response.results = this.store.pushPayload(response)
      afterSearch: (response) => response,
    });
  }

  protected initialSearchState() {
    return {};
  }

  /** An Excel export, with the same calls a search-ui server driver had. */
  exportToExcel = async () => {
    const driver = this.searchDriver;
    const serialized = driver.apiConnector.serializeState(driver.getState());
    serialized.current = 1;
    serialized.resultsPerPage = 5000;
    await driver.apiConnector.makeSearch(
      `${driver.apiConnector.endpoint}.xlsx`,
      serialized,
      { method: 'POST', body: { exportConfig: { export_via: 'payload' } } },
    );
  };

  willDestroy() {
    this.#driver?.tearDown();
    super.willDestroy();
  }
}
