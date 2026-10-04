import type { TOC } from '@ember/component/template-only';
import type { ComponentLike } from '@glint/template';
import {
  legacyChipValues,
  legacyOf,
  type ConditionNode,
  type LegacyProperty,
} from 'ember-search-ui-driver';
import type { FilterChipSignature } from '../../properties.ts';

/** What legacy `listValues` and `listValue` components receive. */
export interface LegacyListValuesArgs {
  property: LegacyProperty;
  value: unknown;
  config?: Record<string, unknown>;
  onClearFilter?: () => void;
}

type LegacyListComponent = ComponentLike<{ Args: LegacyListValuesArgs }>;

const legacy = (property: FilterChipSignature['Args']['property']) =>
  legacyOf(property);
const listValues = (property: FilterChipSignature['Args']['property']) =>
  legacyOf(property)?.componentsForFiltering?.listValues;
const listValue = (property: FilterChipSignature['Args']['property']) =>
  legacyOf(property)?.componentsForFiltering?.listValue;
const asComponent = (component: unknown) => component as LegacyListComponent;
const valuesOf = (node: ConditionNode) => legacyChipValues(node);

/**
 * Shows a set filter with a legacy property's chips, unchanged: its
 * `listValues` component with all values, else its `listValue` component
 * once per value (as the legacy current-filters list does).
 */
const LegacyFilterChip: TOC<FilterChipSignature> = <template>
  {{#let (legacy @property) as |original|}}
    {{#if original}}
      {{#let (listValues @property) (listValue @property) as |many one|}}
        {{#if many.component}}
          {{#let (asComponent many.component) as |ListValues|}}
            <ListValues
              @config={{many.args}}
              @value={{valuesOf @node}}
              @property={{original}}
              @onClearFilter={{@remove}}
            />
          {{/let}}
        {{else if one.component}}
          {{#let (asComponent one.component) as |ListValue|}}
            {{#each (valuesOf @node) as |value|}}
              <ListValue
                @value={{value}}
                @config={{one.args}}
                @property={{original}}
              />
            {{/each}}
          {{/let}}
        {{/if}}
      {{/let}}
    {{/if}}
  {{/let}}
</template>;

export default LegacyFilterChip;
