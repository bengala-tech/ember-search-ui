import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { hash } from '@ember/helper';
import type { ComponentLike } from '@glint/template';
import {
  legacyEditorValue,
  legacyOf,
  legacyValuePatch,
  type LegacyFilterComponentDefinition,
  type LegacyProperty,
} from 'ember-search-ui-driver';
import type { FilterEditorSignature } from '../../properties.ts';

/** What a legacy filter component receives. */
export interface LegacyFilterComponentArgs {
  property: LegacyProperty;
  value?: unknown;
  onChange: (value: unknown) => void;
  config?: Record<string, unknown>;
  form?: unknown;
  renderInPlace?: boolean;
}

export interface LegacyFilterEditorSignature {
  Args: FilterEditorSignature['Args'] & {
    /** Read array values like search-ui 1.20 (`keep`) or 1.21+ (`flatten`). */
    arrays?: 'flatten' | 'keep';
    /** Passed through to the legacy component. */
    form?: unknown;
    renderInPlace?: boolean;
    /**
     * Apply every change at once (default), or keep a draft until the
     * yielded `apply` runs, like the legacy filter container's Apply button.
     */
    applyOnChange?: boolean;
  };
  Blocks: {
    default: [
      {
        value: unknown;
        apply: () => void;
        remove: () => void;
        isDirty: boolean;
      },
    ];
  };
}

const NONE = Symbol('none');

/** The legacy container unwraps picked `{ value }` objects in arrays. */
function unwrap(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) =>
    typeof item === 'object' &&
    item !== null &&
    Object.prototype.hasOwnProperty.call(item, 'value')
      ? (item as { value: unknown }).value
      : item,
  );
}

/**
 * Runs a legacy filter component (componentsForFiltering.filter) as a
 * property filter editor, unchanged: it gets the original legacy property,
 * its `args` as `@config`, `@value` as search-ui gave it, and `@onChange`.
 */
export default class LegacyFilterEditor extends Component<LegacyFilterEditorSignature> {
  @tracked draft: unknown = NONE;

  get legacy(): LegacyProperty | undefined {
    return legacyOf(this.args.property);
  }

  get definition(): LegacyFilterComponentDefinition | undefined {
    return this.legacy?.componentsForFiltering?.filter;
  }

  get component():
    ComponentLike<{ Args: LegacyFilterComponentArgs }> | undefined {
    const definition = this.definition;
    if (!definition?.component || !this.legacy) return undefined;
    if (definition.shouldShow && !definition.shouldShow(this.legacy))
      return undefined;
    return definition.component as ComponentLike<{
      Args: LegacyFilterComponentArgs;
    }>;
  }

  get value(): unknown {
    return this.draft === NONE ? legacyEditorValue(this.args.node) : this.draft;
  }

  get isDirty(): boolean {
    return this.draft !== NONE;
  }

  onChange = (value: unknown): void => {
    this.draft = unwrap(value);
    if (this.args.applyOnChange !== false) this.apply();
  };

  apply = (): void => {
    if (this.draft === NONE) return;
    const patch = legacyValuePatch(
      this.args.property,
      this.draft,
      this.args.arrays ? { arrays: this.args.arrays } : {},
    );
    this.draft = NONE;
    if (patch) this.args.update(patch);
    else this.args.remove();
  };

  remove = (): void => {
    this.draft = NONE;
    this.args.remove();
  };

  <template>
    {{#if this.legacy}}
      {{#let this.component as |Legacy|}}
        {{#if Legacy}}
          <Legacy
            @property={{this.legacy}}
            @config={{this.definition.args}}
            @value={{this.value}}
            @onChange={{this.onChange}}
            @form={{@form}}
            @renderInPlace={{@renderInPlace}}
          />
        {{/if}}
      {{/let}}
      {{yield
        (hash
          value=this.value
          apply=this.apply
          remove=this.remove
          isDirty=this.isDirty
        )
      }}
    {{/if}}
  </template>
}
