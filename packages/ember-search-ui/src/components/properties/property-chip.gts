import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { ComponentLike } from '@glint/template';
import {
  legacyChipValues,
  legacyOf,
  propertyFilter,
  setPropertyFilter,
  toProperty,
  type AnyProperty,
  type ConditionNode,
  type Property,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from '../../tracked-search.ts';
import type { FilterChipSignature } from '../../properties.ts';
import LegacyFilterChip from './legacy-filter-chip.gts';

export interface PropertyChipSignature {
  Args: {
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    property: AnyProperty<never, unknown>;
  };
  Blocks: {
    /** Rendered when the property has no chip component. */
    default: [
      {
        property: Property;
        node: ConditionNode;
        values: unknown[];
        remove: () => void;
      },
    ];
  };
}

/**
 * The set filter of one property, as a chip: the property's `filter.chip`,
 * else its legacy listValues / listValue components, else the block.
 * Renders nothing while the property has no filter.
 */
export default class PropertyChip extends Component<PropertyChipSignature> {
  get property(): Property {
    return toProperty(this.args.property) as Property;
  }

  get node(): ConditionNode | undefined {
    return propertyFilter(this.args.search.state, this.args.property);
  }

  get chip(): ComponentLike<FilterChipSignature> | undefined {
    const { filter } = this.property;
    return filter && filter.chip
      ? (filter.chip as ComponentLike<FilterChipSignature>)
      : undefined;
  }

  get isLegacy(): boolean {
    const components = legacyOf(this.args.property)?.componentsForFiltering;
    return Boolean(
      components?.listValues?.component || components?.listValue?.component,
    );
  }

  get values(): unknown[] {
    return legacyChipValues(this.node);
  }

  remove = (): void => {
    setPropertyFilter(this.args.search.driver, this.args.property, undefined);
  };

  <template>
    {{#if this.node}}
      {{#if this.chip}}
        {{#let this.chip as |Chip|}}
          <Chip
            @property={{this.property}}
            @node={{this.node}}
            @remove={{this.remove}}
          />
        {{/let}}
      {{else if this.isLegacy}}
        <LegacyFilterChip
          @property={{this.property}}
          @node={{this.node}}
          @remove={{this.remove}}
        />
      {{else}}
        {{yield
          (hash
            property=this.property
            node=this.node
            values=this.values
            remove=this.remove
          )
        }}
      {{/if}}
    {{/if}}
  </template>
}
