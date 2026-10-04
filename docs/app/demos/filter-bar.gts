import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import { schemaFrom, type SearchDriver } from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import { FilterBar, FilterChips } from 'ember-search-ui-views';
import type { Inspection } from '../demo/data.ts';
import { PROPERTIES } from '../properties/properties.ts';
import PropertyTable from '../properties/property-table.gts';
import { demoDriver } from './demo-driver.ts';

/** The example properties driving a filter bar, chips and a table. */
export default class FilterBarDemo extends Component {
  driver: SearchDriver<Inspection>;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = demoDriver(this, { schema: schemaFrom(PROPERTIES) });
  }

  <template>
    <Search @driver={{this.driver}} as |search|>
      <FilterBar @search={{search}} @properties={{PROPERTIES}} />
      <FilterChips @search={{search}} @properties={{PROPERTIES}} />
      <p data-test-bar-total>{{search.total}} inspections</p>
      <PropertyTable @search={{search}} @properties={{PROPERTIES}} />
    </Search>
  </template>
}
