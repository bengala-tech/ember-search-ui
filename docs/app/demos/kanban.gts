import Component from '@glimmer/component';
import type Owner from '@ember/owner';
import {
  findProperty,
  readPath,
  schemaFrom,
  toProperties,
  type AnyProperty,
  type Option,
  type SearchDriver,
} from 'ember-search-ui-driver';
import { Search, type TrackedSearch } from 'ember-search-ui';
import { FilterBar } from 'ember-search-ui-views';
import type { Inspection } from '../demo/data.ts';
import { PROPERTIES } from '../properties/properties.ts';
import { display } from '../properties/display.ts';
import { demoDriver } from './demo-driver.ts';
import QueryInspector from '../components/query-inspector.gts';

interface Signature {
  Args: {
    /** The property whose options are the columns. */
    groupBy?: string;
  };
}

interface Column {
  option: Option;
  rows: unknown[];
}

/**
 * A view in about forty lines: a kanban board. It reads the properties
 * (columns from the grouping property's options, card titles from the
 * `title` property) and the search's results; it never fetches.
 */
export function columnsOf(
  search: TrackedSearch<unknown>,
  properties: readonly AnyProperty<never, unknown>[],
  groupBy: string,
): Column[] {
  const property = findProperty(properties, groupBy);
  const options = property?.field.options ?? [];
  return options.map((option) => ({
    option,
    rows: search.results.filter(
      (row) => readPath(row, property!.field.path) === option.value,
    ),
  }));
}

const titleOf = (
  properties: readonly AnyProperty<never, unknown>[],
  row: unknown,
) => {
  const titled = toProperties(properties).find(
    (p) => p.views?.list?.role === 'title',
  );
  return titled ? display(titled, row) : '';
};

export default class KanbanDemo extends Component<Signature> {
  driver: SearchDriver<Inspection>;

  constructor(owner: Owner, args: Signature['Args']) {
    super(owner, args);
    this.driver = demoDriver(this, {
      schema: schemaFrom(PROPERTIES),
      initialState: { page: { kind: 'offset', page: 1, perPage: 100 } },
    });
  }

  get groupBy() {
    return this.args.groupBy ?? 'priority';
  }

  <template>
    <Search @driver={{this.driver}} as |search|>
      <QueryInspector @search={{search}} />
      <FilterBar @search={{search}} @properties={{PROPERTIES}} />
      <div class="kanban">
        {{#each (columnsOf search PROPERTIES this.groupBy) as |column|}}
          <section
            class="kanban-column"
            data-test-column={{column.option.value}}
          >
            <h4>{{column.option.label}}
              <small>{{column.rows.length}}</small></h4>
            {{#each column.rows as |row|}}
              <div class="kanban-card">{{titleOf PROPERTIES row}}</div>
            {{/each}}
          </section>
        {{/each}}
      </div>
    </Search>
  </template>
}
