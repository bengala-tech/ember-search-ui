import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { ComponentLike } from '@glint/template';
import {
  legacyOf,
  propertyFilter,
  setPropertyFilter,
  toProperty,
  type AnyProperty,
  type ConditionNode,
  type ConditionPatch,
  type Property,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from '../../tracked-search.ts';
import type { FilterEditorSignature } from '../../properties.ts';
import LegacyFilterEditor from './legacy-filter-editor.gts';

export interface PropertyFilterSignature {
  Args: {
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    property: AnyProperty<never, unknown>;
    /** For legacy editors: array values as search-ui 1.20 (`keep`) or 1.21+. */
    arrays?: 'flatten' | 'keep';
    /** For legacy editors: passed through. */
    form?: unknown;
    renderInPlace?: boolean;
    /** For legacy editors: apply each change (default) or on `apply`. */
    applyOnChange?: boolean;
  };
  Blocks: {
    /**
     * Rendered when the property has no editor: build one here. Legacy
     * editors yield `{ value, apply, remove, isDirty }` instead (for an
     * Apply button).
     */
    default: [
      {
        property: Property;
        node: ConditionNode | undefined;
        update: (patch: ConditionPatch) => void;
        remove: () => void;
        value?: unknown;
        apply?: () => void;
        isDirty?: boolean;
      },
    ];
  };
}

/**
 * The filter editor of one property, on the condition on its field under
 * the root: the property's `filter.editor`, else its legacy filter
 * component (unchanged, through LegacyFilterEditor), else the block.
 */
export default class PropertyFilter extends Component<PropertyFilterSignature> {
  get property(): Property {
    return toProperty(this.args.property) as Property;
  }

  get node(): ConditionNode | undefined {
    return propertyFilter(this.args.search.state, this.args.property);
  }

  get editor(): ComponentLike<FilterEditorSignature> | undefined {
    const { filter } = this.property;
    return filter && filter.editor
      ? (filter.editor as ComponentLike<FilterEditorSignature>)
      : undefined;
  }

  get isLegacy(): boolean {
    return Boolean(
      legacyOf(this.args.property)?.componentsForFiltering?.filter?.component,
    );
  }

  update = (patch: ConditionPatch): void => {
    setPropertyFilter(this.args.search.driver, this.args.property, patch);
  };

  remove = (): void => {
    setPropertyFilter(this.args.search.driver, this.args.property, undefined);
  };

  <template>
    {{#if this.editor}}
      {{#let this.editor as |Editor|}}
        <Editor
          @property={{this.property}}
          @node={{this.node}}
          @update={{this.update}}
          @remove={{this.remove}}
        />
      {{/let}}
    {{else if this.isLegacy}}
      <LegacyFilterEditor
        @property={{this.property}}
        @node={{this.node}}
        @update={{this.update}}
        @remove={{this.remove}}
        @arrays={{@arrays}}
        @form={{@form}}
        @renderInPlace={{@renderInPlace}}
        @applyOnChange={{@applyOnChange}}
        as |legacy|
      >
        {{yield
          (hash
            property=this.property
            node=this.node
            update=this.update
            remove=this.remove
            value=legacy.value
            apply=legacy.apply
            isDirty=legacy.isDirty
          )
        }}
      </LegacyFilterEditor>
    {{else}}
      {{yield
        (hash
          property=this.property
          node=this.node
          update=this.update
          remove=this.remove
        )
      }}
    {{/if}}
  </template>
}
