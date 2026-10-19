import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import { guidFor } from '@ember/object/internals';
import {
  schemaFrom,
  type NodeId,
  type SearchDriver,
} from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import {
  FilterPills,
  QueryBuilder,
  describeFilter,
} from 'ember-search-ui-views';
import type { Inspection } from '../demo/data.ts';
import { PROPERTIES } from '../properties/properties.ts';
import { demoDriver } from './demo-driver.ts';
import QueryInspector from '../components/query-inspector.gts';
import FilterPresets from '../components/filter-presets.gts';

const SCHEMA = schemaFrom(PROPERTIES);
const describe = (filter: Parameters<typeof describeFilter>[0]) =>
  describeFilter(filter, SCHEMA);

/** The QueryBuilder over the example properties, with pills above it. */
export default class QueryBuilderDemo extends Component {
  driver: SearchDriver<Inspection>;
  id = guidFor(this);

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = demoDriver(this, 'qb.', { schema: SCHEMA });
  }

  /** Pill "Edit": scrolls to the node's row in the builder and focuses it. */
  edit = (nodeId: NodeId): void => {
    const row = document.querySelector(
      `#${this.id} [data-node-id="${CSS.escape(nodeId)}"]`,
    );
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    (
      row?.querySelector<HTMLElement>('input, select') ??
      row?.querySelector<HTMLElement>('button')
    )?.focus();
  };

  <template>
    <Search @driver={{this.driver}} as |search|>
      <QueryInspector @search={{search}} />
      <FilterPresets @search={{search}} />
      <FilterPills
        @search={{search}}
        @properties={{PROPERTIES}}
        @onEdit={{this.edit}}
        data-test-qb-pills
      />
      <QueryBuilder
        id={{this.id}}
        @search={{search}}
        @properties={{PROPERTIES}}
      />
      <p><strong>Filter:</strong>
        <span data-test-qb-text>{{describe search.filter}}</span></p>
      <p><strong>Matches:</strong>
        <span data-test-qb-total>{{search.total}}</span>
        inspections</p>
    </Search>
  </template>
}
