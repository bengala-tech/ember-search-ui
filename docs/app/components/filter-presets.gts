import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import {
  materialize,
  searchApiCodec,
  sequentialIds,
  type GroupNode,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { PRESETS, type FilterPreset } from '../demos/presets.ts';

interface Signature {
  Args: { search: TrackedSearch<never> | TrackedSearch<unknown> };
}

const LIST = searchApiCodec({ filters: 'list' });

/** Can the flat legacy list format express this preset? */
function fitsList(
  preset: FilterPreset,
  search: Signature['Args']['search'],
): boolean {
  const tree = materialize(
    { ...preset.filter, id: 'root' },
    sequentialIds('preset'),
  ) as GroupNode;
  return LIST.supports(tree, search.driver.codecContext).ok;
}

const eq = (a: unknown, b: unknown) => a === b;

/**
 * One-click complex filters: each replaces the filter tree, so the query
 * builder, the results and "Show query" all show it.
 */
export default class FilterPresets extends Component<Signature> {
  @tracked active?: FilterPreset;

  apply = (preset: FilterPreset) => {
    this.active = preset;
    this.args.search.driver.replaceFilter(preset.filter);
  };

  clear = () => {
    this.active = undefined;
    this.args.search.driver.clearFilter();
  };

  <template>
    <div class="presets" data-test-presets>
      <p class="presets-title">Try a preset:</p>
      <div class="presets-list">
        {{#each PRESETS as |preset|}}
          <button
            type="button"
            class="preset {{if (eq preset.id this.active.id) 'is-active'}}"
            data-test-preset={{preset.id}}
            {{on "click" (fn this.apply preset)}}
          >
            {{preset.title}}
            {{#if (fitsList preset @search)}}
              <span class="preset-badge">legacy list too</span>
            {{else}}
              <span class="preset-badge is-groups">groups only</span>
            {{/if}}
          </button>
        {{/each}}
        <button
          type="button"
          class="preset preset-clear"
          data-test-preset-clear
          {{on "click" this.clear}}
        >Clear</button>
      </div>
      {{#if this.active}}
        <p class="presets-note" data-test-preset-note>{{this.active.note}}
          Open
          <strong>Show query</strong>
          to see it serialized.</p>
      {{/if}}
    </div>
  </template>
}
