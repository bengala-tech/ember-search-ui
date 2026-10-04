import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import type { SearchDriver } from 'ember-search-ui-driver';
import { Search, type TrackedSearch } from 'ember-search-ui';
import type { Inspection } from '../demo/data.ts';
import { demoDriver } from './demo-driver.ts';
import QueryInspector from '../components/query-inspector.gts';

const pageOf = (search: TrackedSearch<Inspection>) =>
  search.state.page.kind === 'offset' ? search.state.page.page : 1;
const termOf = (event: Event) => (event.target as HTMLInputElement).value;

/** The getting-started example: a search box, results and paging. */
export default class QuickStart extends Component {
  driver: SearchDriver<Inspection>;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = demoDriver(this);
  }

  search = (event: Event) => this.driver.setQuery(termOf(event));

  turn = (search: TrackedSearch<Inspection>, by: number) =>
    this.driver.setPage(pageOf(search) + by);

  <template>
    <Search @driver={{this.driver}} as |search|>
      <QueryInspector @search={{search}} />
      <input
        type="search"
        placeholder="Search inspections"
        aria-label="Search inspections"
        data-test-quick-search
        {{on "input" this.search}}
      />
      <p data-test-quick-total>{{search.total}} inspections</p>
      <ul data-test-quick-results>
        {{#each search.results as |inspection|}}
          <li>{{inspection.title}}</li>
        {{/each}}
      </ul>
      <button
        type="button"
        {{on "click" (fn this.turn search -1)}}
      >Previous</button>
      <span data-test-quick-page>page
        {{pageOf search}}
        of
        {{search.result.pageCount}}</span>
      <button
        type="button"
        data-test-quick-next
        {{on "click" (fn this.turn search 1)}}
      >Next</button>
    </Search>
  </template>
}
