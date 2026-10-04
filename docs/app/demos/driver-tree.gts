import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import { and, eq, or, type SearchDriver } from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import { describeFilter } from 'ember-search-ui-views';
import { FIELDS, type Inspection } from '../demo/data.ts';
import { demoDriver } from './demo-driver.ts';

const describe = (filter: Parameters<typeof describeFilter>[0]) =>
  describeFilter(filter, FIELDS);

/** Builds a filter tree with driver commands, one button at a time. */
export default class DriverTree extends Component {
  driver: SearchDriver<Inspection>;
  group?: string;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.driver = demoDriver(this);
  }

  addGroup = () => {
    // (state is done) or (priority is high and project is Monterrey plant)
    this.group = this.driver.add(
      'root',
      or(
        eq('state', 'done'),
        and(eq('priority', 'high'), eq('project', 'Monterrey plant')),
      ),
    );
  };

  negate = () => {
    if (this.group) this.driver.toggleNegate(this.group);
  };

  disable = () => {
    if (this.group) this.driver.toggleDisabled(this.group);
  };

  clear = () => {
    this.group = undefined;
    this.driver.clearFilter();
  };

  <template>
    <Search @driver={{this.driver}} as |search|>
      <p class="demo-buttons">
        <button
          type="button"
          data-test-tree-add
          {{on "click" this.addGroup}}
        >Add the group</button>
        <button
          type="button"
          data-test-tree-negate
          {{on "click" this.negate}}
        >Toggle NOT</button>
        <button
          type="button"
          data-test-tree-disable
          {{on "click" this.disable}}
        >Toggle on/off</button>
        <button type="button" {{on "click" this.clear}}>Clear</button>
      </p>
      <p><strong>Filter:</strong>
        <span data-test-tree-text>{{describe search.filter}}</span></p>
      <p><strong>Matches:</strong>
        <span data-test-tree-total>{{search.total}}</span>
        inspections</p>
    </Search>
  </template>
}
