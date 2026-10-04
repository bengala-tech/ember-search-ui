import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { LegacyFilterComponentArgs } from 'ember-search-ui';

interface Choice {
  value: string;
  label: string;
}

const checked = (value: unknown, choice: Choice) =>
  Array.isArray(value) && value.includes(choice.value);

/**
 * A filter component written for the legacy property shape: it gets the
 * legacy property, `@config` (componentsForFiltering.filter.args), the
 * current `@value` and `@onChange`, and hands back { value, label } picks.
 * It runs unchanged in the filter bar and in the query builder.
 */
export default class LegacyStatePicker extends Component<{
  Args: LegacyFilterComponentArgs;
}> {
  get choices(): Choice[] {
    return (this.args.config?.['choices'] as Choice[] | undefined) ?? [];
  }

  toggle = (choice: Choice, event: Event) => {
    const on = (event.target as HTMLInputElement).checked;
    const current = Array.isArray(this.args.value)
      ? (this.args.value as string[])
      : [];
    const next = on
      ? [...current, choice.value]
      : current.filter((v) => v !== choice.value);
    this.args.onChange(this.choices.filter((c) => next.includes(c.value)));
  };

  <template>
    <span class="legacy-picker" role="group" aria-label={{@property.name}}>
      {{#each this.choices as |choice|}}
        <label class="legacy-choice">
          <input
            type="checkbox"
            data-test-legacy-state={{choice.value}}
            checked={{checked @value choice}}
            {{on "change" (fn this.toggle choice)}}
          />
          {{choice.label}}
        </label>
      {{/each}}
    </span>
  </template>
}
