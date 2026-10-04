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
  Args: {
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    /** The request format this page sends; presets it cannot express are off. */
    sends?: 'groups';
  };
}

const LIST = searchApiCodec({ filters: 'list' });
const GROUPS = searchApiCodec({ filters: 'groups' });

type Reach = 'list' | 'groups' | 'memory';

const BADGES: Record<Reach, string> = {
  list: 'legacy list too',
  groups: 'groups only',
  memory: 'in-memory only',
};

/** The widest format that can express this preset. */
function reachOf(
  preset: FilterPreset,
  search: Signature['Args']['search'],
): Reach {
  const tree = materialize(
    { ...preset.filter, id: 'root' },
    sequentialIds('preset'),
  ) as GroupNode;
  const ctx = search.driver.codecContext;
  if (LIST.supports(tree, ctx).ok) return 'list';
  return GROUPS.supports(tree, ctx).ok ? 'groups' : 'memory';
}

const badge = (reach: Reach) => BADGES[reach];
const unsendable = (reach: Reach, sends: Signature['Args']['sends']) =>
  sends === 'groups' && reach === 'memory';

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
          {{#let (reachOf preset @search) as |reach|}}
            <button
              type="button"
              class="preset {{if (eq preset.id this.active.id) 'is-active'}}"
              disabled={{unsendable reach @sends}}
              title={{if
                (unsendable reach @sends)
                "Lists inside records need a nested query, which the groups request has no form for yet. Try it in the Filtering guide's in-memory demo."
              }}
              data-test-preset={{preset.id}}
              {{on "click" (fn this.apply preset)}}
            >
              {{preset.title}}
              <span class="preset-badge is-{{reach}}">{{badge reach}}</span>
            </button>
          {{/let}}
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
