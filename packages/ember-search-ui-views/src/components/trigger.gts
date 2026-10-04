import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import type { PowerSelectTriggerSignature } from 'ember-power-select/components/power-select/trigger';
import { and, not } from '../-private/template-helpers.ts';

type TriggerArgs = PowerSelectTriggerSignature['Args'];

const clear = (select: TriggerArgs['select']) => (event: Event) => {
  event.stopPropagation();
  select.actions.select(null);
};

/** ember-power-select trigger styled like search-ui's react-select. */
const Trigger: TOC<{
  Element: HTMLUListElement;
  Args: TriggerArgs;
  Blocks: PowerSelectTriggerSignature['Blocks'];
}> = <template>
  {{#if @select.selected}}
    {{#if @selectedItemComponent}}
      <@selectedItemComponent
        @extra={{@extra}}
        @selected={{@select.selected}}
        @select={{@select}}
      />
    {{else}}
      <span class="ember-power-select-selected-item">
        {{yield @select.selected @select}}
      </span>
    {{/if}}
    {{#if (and @allowClear (not @select.disabled))}}
      <span
        role="button"
        class="ember-power-select-clear-btn"
        {{on "mousedown" (clear @select)}}
        {{on "touchstart" (clear @select)}}
      >
        ×
      </span>
    {{/if}}
  {{else if @placeholderComponent}}
    <@placeholderComponent @placeholder={{@placeholder}} @select={{@select}} />
  {{/if}}
  <div class="css-1wy0on6 sui-select__indicators">
    <span class="css-0 sui-select__indicator-separator"></span>
    <div
      aria-hidden="true"
      class="css-0 sui-select__indicator sui-select__dropdown-indicator"
    >
      <svg
        height="20"
        width="20"
        viewBox="0 0 20 20"
        aria-hidden="true"
        focusable="false"
        class="css-19bqh2r"
      >
        <path
          d="M4.516 7.548c0.436-0.446 1.043-0.481 1.576 0l3.908 3.747 3.908-3.747c0.533-0.481 1.141-0.446 1.574 0 0.436 0.445 0.408 1.197 0 1.615-0.406 0.418-4.695 4.502-4.695 4.502-0.217 0.223-0.502 0.335-0.787 0.335s-0.57-0.112-0.789-0.335c0 0-4.287-4.084-4.695-4.502s-0.436-1.17 0-1.615z"
        ></path>
      </svg>
    </div>
  </div>
</template>;

export default Trigger;
