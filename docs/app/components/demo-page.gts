import Component from '@glimmer/component';
import { registerDestructor } from '@ember/destroyable';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import { Search, type TrackedSearch } from 'ember-search-ui';
import { QueryBuilder } from 'ember-search-ui-views';
import { FIELDS, type Inspection } from '../demo/data.ts';
import { DemoSession, type Format } from '../demo/session.ts';
import LegacyFilters from './legacy-filters.gts';
import Pager from './pager.gts';
import ResultsTable from './results-table.gts';
import WirePanel from './wire-panel.gts';
import FilterPresets from './filter-presets.gts';

interface Signature {
  Args: { format: Format };
}

const pageOf = (search: TrackedSearch<Inspection>) =>
  search.state.page.kind === 'offset' ? search.state.page.page : 1;

/**
 * A search page. `list` mimics a legacy filter UI through the search-ui compat
 * API and sends the legacy list; `groups` uses the QueryBuilder and sends the
 * documented groups spec. Both keep the same internal state.
 */
export default class DemoPage extends Component<Signature> {
  session: DemoSession;

  constructor(owner: Owner, args: Signature['Args']) {
    super(owner, args);
    this.session = new DemoSession(
      args.format,
      args.format === 'list' ? 'legacy.' : 'groups.',
    );
    registerDestructor(this, () => this.session.destroy());
  }

  get isLegacy() {
    return this.args.format === 'list';
  }

  search = (event: Event) => {
    const term = (event.target as HTMLInputElement).value;
    if (this.isLegacy) {
      // the legacy search box keeps its filters
      this.session.compat.actions.setSearchTerm(term, {
        shouldClearFilters: false,
      });
    } else {
      this.session.driver.setQuery(term);
    }
  };

  sortBy = (field: string) => {
    const [current] = this.session.driver.state.sort;
    const direction =
      current?.field === field && current.direction === 'asc' ? 'desc' : 'asc';
    if (this.isLegacy) this.session.compat.actions.setSort(field, direction);
    else this.session.driver.setSort([{ field, direction }]);
  };

  goTo = (page: number) => {
    if (this.isLegacy) this.session.compat.actions.setCurrent(page);
    else this.session.driver.setPage(page);
  };

  <template>
    <Search
      @driver={{this.session.driver}}
      @syncUrl={{this.session.urlSync}}
      as |search|
    >
      <div class="layout">
        <div class="main">
          <label class="search">
            <span class="visually-hidden">Search inspections</span>
            <input
              type="search"
              placeholder="Search title, description or project"
              value={{search.state.query.term}}
              data-test-search
              {{on "change" this.search}}
            />
          </label>

          {{#if this.isLegacy}}
            <LegacyFilters @compat={{this.session.compat}} @search={{search}} />
          {{else}}
            <FilterPresets @search={{search}} />
            <QueryBuilder @search={{search}} @fields={{FIELDS}} />
          {{/if}}

          <ResultsTable
            @results={{search.results}}
            @sort={{search.state.sort}}
            @onSort={{this.sortBy}}
            @loading={{search.isLoading}}
          />
          <Pager
            @page={{pageOf search}}
            @pageCount={{search.result.pageCount}}
            @total={{search.total}}
            @onChange={{this.goTo}}
          />
        </div>
        <aside class="side">
          <WirePanel @session={{this.session}} @search={{search}} />
        </aside>
      </div>
    </Search>
  </template>
}
