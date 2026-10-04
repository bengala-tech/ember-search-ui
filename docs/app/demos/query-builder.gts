import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import { schemaFrom, type SearchDriver } from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import { QueryBuilder, describeFilter } from 'ember-search-ui-views';
import type { Inspection } from '../demo/data.ts';
import { PROPERTIES } from '../properties/properties.ts';
import { demoDriver } from './demo-driver.ts';

const SCHEMA = schemaFrom(PROPERTIES);
const describe = (filter: Parameters<typeof describeFilter>[0]) =>
  describeFilter(filter, SCHEMA);

/** The QueryBuilder over the example properties. */
export default class QueryBuilderDemo extends Component {
  driver: SearchDriver<Inspection>;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = demoDriver(this, { schema: SCHEMA });
  }

  <template>
    <Search @driver={{this.driver}} as |search|>
      <QueryBuilder @search={{search}} @properties={{PROPERTIES}} />
      <p><strong>Filter:</strong>
        <span data-test-qb-text>{{describe search.filter}}</span></p>
      <p><strong>Matches:</strong>
        <span data-test-qb-total>{{search.total}}</span>
        inspections</p>
    </Search>
  </template>
}
