import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import {
  schemaFrom,
  type AnyProperty,
  type ConditionNode,
  type FieldSchema,
} from 'ember-search-ui-driver';
import { PropertyChip, type TrackedSearch } from 'ember-search-ui';
import { describeFilter } from '../query-builder/describe.ts';
import '../styles/filter-bar.css';

export interface FilterChipsSignature {
  Element: HTMLUListElement;
  Args: {
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    properties: readonly AnyProperty<never, unknown>[];
  };
}

/** A condition in words, e.g. "State is open". */
const describe = (node: ConditionNode, fields: FieldSchema) =>
  describeFilter(
    { kind: 'group', id: 'chip', op: 'and', children: [node] },
    fields,
  );

/**
 * The set filters of a filter bar, as chips: each property's chip, its
 * legacy listValues / listValue components, or the condition in words.
 */
const FilterChips: TOC<FilterChipsSignature> = <template>
  <ul class="sui-fb-chips" ...attributes>
    {{#each @properties as |property|}}
      <PropertyChip @search={{@search}} @property={{property}} as |chip|>
        <li class="sui-fb-chip">
          <span>{{describe chip.node (schemaFrom @properties)}}</span>
          <button
            type="button"
            class="sui-fb-chip-remove"
            aria-label="Remove {{chip.property.label}} filter"
            {{on "click" chip.remove}}
          >×</button>
        </li>
      </PropertyChip>
    {{/each}}
  </ul>
</template>;

export default FilterChips;
