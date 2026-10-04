import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import {
  isSortable,
  sortPath,
  toProperties,
  type AnyProperty,
  type Property,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { display, urlOf } from './display.ts';

interface Signature {
  Args: {
    search: TrackedSearch<unknown>;
    properties: readonly AnyProperty<never, unknown>[];
  };
}

/** A table: one column per property, sortable where the property allows. */
export default class PropertyTable extends Component<Signature> {
  get columns(): Property<never, unknown>[] {
    return toProperties(this.args.properties).filter(
      (p) => !p.views?.table?.hidden,
    );
  }

  arrow = (property: Property<never, unknown>) => {
    const [sort] = this.args.search.state.sort;
    if (!sort || sort.field !== sortPath(property)) return '';
    return sort.direction === 'asc' ? '▲' : '▼';
  };

  sortBy = (property: Property<never, unknown>) => {
    const field = sortPath(property);
    if (!field) return;
    const [sort] = this.args.search.state.sort;
    const direction =
      sort?.field === field && sort.direction === 'asc' ? 'desc' : 'asc';
    this.args.search.driver.setSort([{ field, direction }]);
  };

  <template>
    <table class="results property-table" data-test-property-table>
      <thead>
        <tr>
          {{#each this.columns as |column|}}
            <th scope="col">
              {{#if (isSortable column)}}
                <button
                  type="button"
                  data-test-sort={{column.key}}
                  {{on "click" (fn this.sortBy column)}}
                >{{column.label}} {{this.arrow column}}</button>
              {{else}}
                {{column.label}}
              {{/if}}
            </th>
          {{/each}}
        </tr>
      </thead>
      <tbody>
        {{#each @search.results as |row|}}
          <tr data-test-row>
            {{#each this.columns as |column|}}
              <td class={{if column.views.table.numeric "num"}}>
                {{#let (urlOf column row) as |link|}}
                  {{#if link}}
                    <a href={{link.url}}>{{display column row}}</a>
                  {{else}}
                    {{display column row}}
                  {{/if}}
                {{/let}}
              </td>
            {{/each}}
          </tr>
        {{else}}
          <tr><td class="empty" colspan="99">No inspections match.</td></tr>
        {{/each}}
      </tbody>
    </table>
  </template>
}
