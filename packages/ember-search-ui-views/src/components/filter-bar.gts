import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import {
  isFilterable,
  legacyOf,
  propertyFilter,
  setPropertyFilter,
  toProperty,
  type AnyProperty,
  type Property,
} from 'ember-search-ui-driver';
import { PropertyFilter, type TrackedSearch } from 'ember-search-ui';
import { ConditionEditor } from './query-builder.gts';
import '../styles/query-builder.css';
import '../styles/filter-bar.css';

type Input = AnyProperty<never, unknown>;

interface Entry {
  input: Input;
  property: Property;
}

export interface FilterBarSignature {
  Element: HTMLDivElement;
  Args: {
    /** A TrackedSearch, e.g. yielded by <Search>. */
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    /** The properties people can filter on, in either shape. */
    properties: readonly Input[];
    /** For legacy editors: array values as search-ui 1.20 (`keep`) or 1.21+. */
    arrays?: 'flatten' | 'keep';
  };
}

const hasEditor = (entry: Entry) => {
  const { filter } = entry.property;
  return Boolean(
    (filter && filter.editor) ||
    legacyOf(entry.input)?.componentsForFiltering?.filter?.component,
  );
};

/**
 * One filter per property, ANDed: the flat filter bar most lists need. Each
 * property is edited by its own editor, its legacy filter component, or the
 * built-in condition editor. Filters live at `filter:<key>`, the same nodes
 * setFilter edits, next to whatever a QueryBuilder adds.
 */
export default class FilterBar extends Component<FilterBarSignature> {
  /** Properties added that have no condition yet. */
  @tracked pending: string[] = [];

  get entries(): Entry[] {
    return this.args.properties
      .filter((input) => isFilterable(input))
      .map((input) => ({ input, property: toProperty(input) as Property }));
  }

  get active(): Entry[] {
    const state = this.args.search.state;
    return this.entries.filter(
      (entry) =>
        propertyFilter(state, entry.input) !== undefined ||
        this.pending.includes(entry.property.key),
    );
  }

  get available(): Entry[] {
    const active = new Set(this.active.map((entry) => entry.property.key));
    return this.entries.filter((entry) => !active.has(entry.property.key));
  }

  add = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const entry = this.entries.find((e) => e.property.key === select.value);
    select.value = '';
    if (!entry) return;
    if (hasEditor(entry)) {
      this.pending = [...this.pending, entry.property.key];
    } else {
      // the built-in editor works on a condition: start an empty one
      setPropertyFilter(this.args.search.driver, entry.input, {});
    }
  };

  remove = (entry: Entry): void => {
    this.pending = this.pending.filter((key) => key !== entry.property.key);
    setPropertyFilter(this.args.search.driver, entry.input, undefined);
  };

  clear = (): void => {
    const { driver } = this.args.search;
    this.pending = [];
    driver.transaction(() => {
      for (const entry of this.entries)
        setPropertyFilter(driver, entry.input, undefined);
    });
  };

  <template>
    <div class="sui-query-builder sui-filter-bar" ...attributes>
      <ul class="sui-fb-filters">
        {{#each this.active key="property.key" as |entry|}}
          <li class="sui-fb-filter" data-filter-key={{entry.property.key}}>
            <span class="sui-fb-name">{{entry.property.label}}</span>
            <PropertyFilter
              @search={{@search}}
              @property={{entry.input}}
              @arrays={{@arrays}}
              as |filter|
            >
              {{#unless filter.apply}}
                {{#if filter.node}}
                  <ConditionEditor
                    @search={{@search}}
                    @node={{filter.node}}
                    @field={{entry.property.field}}
                  />
                {{/if}}
              {{/unless}}
            </PropertyFilter>
            <button
              type="button"
              class="sui-qb-remove sui-fb-remove"
              aria-label="Remove {{entry.property.label}} filter"
              {{on "click" (fn this.remove entry)}}
            >×</button>
          </li>
        {{else}}
          <li class="sui-qb-empty">No filters: everything matches.</li>
        {{/each}}
      </ul>
      <div class="sui-fb-footer">
        {{#if this.available.length}}
          <select
            class="sui-qb-select sui-fb-add"
            aria-label="Add filter"
            {{on "change" this.add}}
          >
            <option value="">+ Filter…</option>
            {{#each this.available as |entry|}}
              <option
                value={{entry.property.key}}
              >{{entry.property.label}}</option>
            {{/each}}
          </select>
        {{/if}}
        {{#if this.active.length}}
          <button
            type="button"
            class="sui-qb-add sui-fb-clear"
            {{on "click" this.clear}}
          >Clear filters</button>
        {{/if}}
      </div>
    </div>
  </template>
}
