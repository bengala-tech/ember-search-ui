import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { registerDestructor } from '@ember/destroyable';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import {
  SearchDriver,
  exportValue,
  isExportable,
  schemaFrom,
  searchApiBackend,
  toProperties,
} from 'ember-search-ui-driver';
import { Search, type TrackedSearch } from 'ember-search-ui';
import { FilterBar, FilterChips, QueryBuilder } from 'ember-search-ui-views';
import config from 'docs/config/environment';
import type { Inspection } from '../demo/data.ts';
import { NetworkLog, fakeServer } from '../demo/fake-server.ts';
import Pager from '../components/pager.gts';
import { PROPERTIES } from './properties.ts';
import PropertyTable from './property-table.gts';
import PropertyList from './property-list.gts';
import PropertyCalendar from './property-calendar.gts';
import QueryInspector from '../components/query-inspector.gts';

type View = 'table' | 'list' | 'calendar';
const VIEWS: { id: View; name: string }[] = [
  { id: 'table', name: 'Table' },
  { id: 'list', name: 'List' },
  { id: 'calendar', name: 'Calendar' },
];

const eq = (a: unknown, b: unknown) => a === b;
const pretty = (body: string) => JSON.stringify(JSON.parse(body), null, 2);
const pageOf = (search: TrackedSearch<unknown>) =>
  search.state.page.kind === 'offset' ? search.state.page.page : 1;
const csvCell = (value: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * One property list, every view: filters (bar, chips, query builder), a
 * table, a list, a calendar and an export all read PROPERTIES and share
 * one driver. Nothing here names a field.
 */
export default class PropertiesPage extends Component {
  readonly log = new NetworkLog();
  readonly driver: SearchDriver<Inspection>;
  @tracked view: View = 'table';
  @tracked csv = '';

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = new SearchDriver<Inspection>({
      backend: searchApiBackend<Inspection>({
        filters: 'groups',
        request: fakeServer(this.log, {
          latencyMs: config.environment === 'test' ? 0 : 150,
        }),
      }),
      schema: schemaFrom(PROPERTIES),
      initialState: {
        page: { kind: 'offset', page: 1, perPage: 8 },
        sort: [{ field: 'created_at', direction: 'desc' }],
      },
    });
    registerDestructor(this, () => this.driver.destroy());
  }

  show = (view: View) => {
    this.view = view;
  };

  goTo = (page: number) => this.driver.setPage(page);

  exportCsv = () => {
    const columns = toProperties(PROPERTIES).filter((p) => isExportable(p));
    const rows = this.driver.result.results.map((row) =>
      columns.map((p) => csvCell(exportValue(p, row))).join(','),
    );
    this.csv = [columns.map((p) => csvCell(p.label)).join(','), ...rows].join(
      '\n',
    );
  };

  <template>
    <Search @driver={{this.driver}} as |search|>
      <QueryInspector @search={{search}} />
      <div class="layout">
        <div class="main">
          <section class="filters-panel" aria-label="Filters">
            <h2>Filters</h2>
            <FilterBar
              @search={{search}}
              @properties={{PROPERTIES}}
              data-test-filter-bar
            />
            <FilterChips
              @search={{search}}
              @properties={{PROPERTIES}}
              data-test-chips
            />
            <details class="advanced">
              <summary>Advanced: groups, OR, NOT</summary>
              <QueryBuilder @search={{search}} @properties={{PROPERTIES}} />
            </details>
          </section>

          <div class="view-tabs" role="group" aria-label="View">
            {{#each VIEWS as |choice|}}
              <button
                type="button"
                aria-pressed={{if (eq choice.id this.view) "true" "false"}}
                data-test-view={{choice.id}}
                {{on "click" (fn this.show choice.id)}}
              >{{choice.name}}</button>
            {{/each}}
            <span class="total" data-test-total>{{search.total}}
              inspections</span>
            <button
              type="button"
              data-test-export
              {{on "click" this.exportCsv}}
            >Export CSV</button>
          </div>

          {{#if (eq this.view "table")}}
            <PropertyTable @search={{search}} @properties={{PROPERTIES}} />
          {{else if (eq this.view "list")}}
            <PropertyList @search={{search}} @properties={{PROPERTIES}} />
          {{else}}
            <PropertyCalendar
              @search={{search}}
              @properties={{PROPERTIES}}
              @month="2026-03"
            />
          {{/if}}
          {{#unless (eq this.view "calendar")}}
            <Pager
              @page={{pageOf search}}
              @pageCount={{search.result.pageCount}}
              @total={{search.total}}
              @onChange={{this.goTo}}
            />
          {{/unless}}
        </div>
        <aside class="side">
          <h2>Last request</h2>
          {{#if this.log.last}}
            <pre class="json" data-test-request>{{pretty
                this.log.last.body
              }}</pre>
          {{/if}}
          {{#if this.csv}}
            <h2>Export</h2>
            <pre class="json" data-test-csv>{{this.csv}}</pre>
          {{/if}}
        </aside>
      </div>
    </Search>
  </template>
}
