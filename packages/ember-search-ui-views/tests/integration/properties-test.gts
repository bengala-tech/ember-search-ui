import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, select } from '@ember/test-helpers';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import Component from '@glimmer/component';
import type { TOC } from '@ember/component/template-only';
import {
  SearchDriver,
  defineProperty,
  memoryBackend,
  searchUiCompat,
  sequentialIds,
  type LegacyProperty,
} from 'ember-search-ui-driver';
import {
  Search,
  type FilterEditorSignature,
  type LegacyFilterComponentArgs,
  type LegacyListValuesArgs,
} from 'ember-search-ui';
import QueryBuilder from '#src/components/query-builder.gts';
import FilterBar from '#src/components/filter-bar.gts';
import FilterChips from '#src/components/filter-chips.gts';

interface Doc {
  id: number;
  state: string;
  score: number;
  owner: string;
}
const DOCS: Doc[] = [
  { id: 1, state: 'open', score: 10, owner: 'ana' },
  { id: 2, state: 'closed', score: 50, owner: 'bo' },
  { id: 3, state: 'open', score: 90, owner: 'bo' },
  { id: 4, state: 'draft', score: 30, owner: 'ana' },
];

const json = (value: unknown) => JSON.stringify(value) ?? '';
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const idsOf = (results: readonly Doc[]) => results.map((r) => r.id).join(',');
const target = (event: Event) => (event.target as HTMLInputElement).value;

// a new-style editor: picks "high" scores (>= 50) or clears
const highScores = { operator: 'range', value: { gte: 50 } } as const;
const ScoreEditor: TOC<FilterEditorSignature> = <template>
  <span data-test-score-editor>{{json @node.value}}</span>
  <button
    type="button"
    data-test-high
    {{on "click" (fn @update highScores)}}
  >high</button>
  <button
    type="button"
    data-test-clear-score
    {{on "click" @remove}}
  >clear</button>
</template>;

// a legacy filter component, as legacy apps write them
class LegacyOwnerPicker extends Component<{ Args: LegacyFilterComponentArgs }> {
  pick = (event: Event) => this.args.onChange(target(event));
  <template>
    <input
      data-test-owner-input
      aria-label={{@property.name}}
      value={{text @value}}
      {{on "change" this.pick}}
    />
  </template>
}

const OwnerValue: TOC<{ Args: LegacyListValuesArgs }> = <template>
  <li data-test-owner-chip>owner {{json @value}}</li>
</template>;

const state = defineProperty<Doc>({
  label: 'State',
  field: {
    path: 'state',
    type: 'keyword',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
      { value: 'draft', label: 'Draft' },
    ],
  },
});
const score = defineProperty<Doc>({
  label: 'Score',
  field: { path: 'score', type: 'number' },
  filter: { editor: ScoreEditor },
});
const hidden = defineProperty<Doc>({
  label: 'Id',
  field: { path: 'id', type: 'number' },
  filter: false,
});
const owner: LegacyProperty = {
  name: 'Owner',
  valuePath: 'owner',
  componentsForFiltering: {
    filter: { component: LegacyOwnerPicker },
    listValue: { component: OwnerValue },
  },
};
const PROPERTIES = [state, score, hidden, owner];

// a list inside each record: only a nested scope can filter its items
const notes = defineProperty<Doc>({
  label: 'Notes',
  field: {
    path: 'notes',
    type: 'object',
    nested: true,
    fields: { text: { path: 'text', type: 'text' } },
  },
});
const WITH_NESTED = [...PROPERTIES, notes];

const ROOT = '.sui-query-builder > .sui-qb-group';
const row = (n: number) =>
  `${ROOT} > .sui-qb-children > li:nth-child(${n}) > .sui-qb-condition`;
const addCondition = `${ROOT} > .sui-qb-footer button[data-test-add="condition"]`;

module(
  'Integration | properties in the query builder and filter bar',
  function (hooks) {
    setupRenderingTest(hooks);

    // a const object: templates may not read reassigned variables
    const ctx = {} as { driver: SearchDriver<Doc> };
    hooks.beforeEach(function () {
      ctx.driver = new SearchDriver<Doc>({
        backend: memoryBackend(DOCS),
        idFactory: sequentialIds(),
      });
    });
    hooks.afterEach(function () {
      ctx.driver.destroy();
    });

    test('QueryBuilder offers filterable properties and uses their editors', async function (assert) {
      await render(
        <template>
          <Search @driver={{ctx.driver}} as |search|>
            <QueryBuilder @search={{search}} @properties={{PROPERTIES}} />
            <p data-test-ids>{{idsOf search.results}}</p>
          </Search>
        </template>,
      );
      await click(addCondition);
      const fields = [
        ...document.querySelectorAll(`${row(1)} .sui-qb-field option`),
      ].map((o) => o.textContent?.trim());
      assert.deepEqual(
        fields,
        ['State', 'Score', 'Owner'],
        'not the non-filterable Id',
      );

      // the built-in editor for a property without one
      await select(`${row(1)} .sui-qb-operator`, 'any_of');
      assert.dom(`${row(1)} .sui-qb-operator`).exists();

      // a property editor replaces the operator and value inputs
      await select(`${row(1)} .sui-qb-field`, 'score');
      assert.dom(`${row(1)} .sui-qb-operator`).doesNotExist();
      await click(`${row(1)} [data-test-high]`);
      assert.dom('[data-test-ids]').hasText('2,3');
      assert.dom(`${row(1)} [data-test-score-editor]`).hasText('{"gte":50}');
      // clearing keeps the row (it has its own delete button) with no effect
      await click(`${row(1)} [data-test-clear-score]`);
      assert.dom(row(1)).exists();
      assert.dom('[data-test-ids]').hasText('1,2,3,4');

      // a legacy filter component edits its rows too
      await click(addCondition);
      await select(`${row(2)} .sui-qb-field`, 'owner');
      await fillIn(`${row(2)} [data-test-owner-input]`, 'bo');
      assert.dom('[data-test-ids]').hasText('2,3');
    });

    test('FilterBar: one filter per property, with every kind of editor', async function (assert) {
      await render(
        <template>
          <Search @driver={{ctx.driver}} as |search|>
            <FilterBar @search={{search}} @properties={{PROPERTIES}} />
            <FilterChips @search={{search}} @properties={{PROPERTIES}} />
            <p data-test-ids>{{idsOf search.results}}</p>
          </Search>
        </template>,
      );
      assert.dom('.sui-fb-filters .sui-qb-empty').exists();
      const options = () =>
        [...document.querySelectorAll('.sui-fb-add option')].map((o) =>
          o.textContent?.trim(),
        );
      assert.deepEqual(options(), ['+ Filter…', 'State', 'Score', 'Owner']);

      // a property without an editor gets the built-in one
      await select('.sui-fb-add', 'state');
      assert.dom('[data-filter-key="state"] .sui-qb-operator').exists();
      // keyword with options: "any of", as checkboxes
      await click(
        '[data-filter-key="state"] .sui-qb-option:nth-child(1) input',
      );
      assert.dom('[data-test-ids]').hasText('1,3');
      assert.dom('.sui-fb-chip').includesText('State');
      assert.dom('.sui-fb-chip').includesText('Open');
      assert.deepEqual(
        options(),
        ['+ Filter…', 'Score', 'Owner'],
        'added ones leave the list',
      );

      // a property editor
      await select('.sui-fb-add', 'score');
      assert
        .dom('[data-filter-key="score"] [data-test-score-editor]')
        .hasText('');
      await click('[data-test-high]');
      assert.dom('[data-test-ids]').hasText('3');

      // a legacy filter component, and its legacy chip
      await select('.sui-fb-add', 'owner');
      await fillIn('[data-test-owner-input]', 'ana');
      assert.dom('[data-test-ids]').hasText('');
      assert.dom('[data-test-owner-chip]').hasText('owner "ana"');

      await click('[aria-label="Remove Score filter"]');
      await click('.sui-fb-chip-remove');
      assert.dom('[data-test-ids]').hasText('1,4');
      await click('.sui-fb-clear');
      assert.dom('[data-test-ids]').hasText('1,2,3,4');
      assert.dom('.sui-fb-filters .sui-qb-empty').exists();
    });

    test('FilterBar leaves properties over nested lists out', async function (assert) {
      await render(
        <template>
          <Search @driver={{ctx.driver}} as |search|>
            <FilterBar @search={{search}} @properties={{WITH_NESTED}} />
          </Search>
        </template>,
      );
      assert.deepEqual(
        [...document.querySelectorAll('.sui-fb-add option')].map((o) =>
          o.textContent?.trim(),
        ),
        ['+ Filter…', 'State', 'Score', 'Owner'],
      );
    });

    test('FilterBar shows filters set elsewhere, e.g. by legacy setFilter', async function (assert) {
      searchUiCompat(ctx.driver).setFilter('owner', 'bo', 'any');
      await render(
        <template>
          <Search @driver={{ctx.driver}} as |search|>
            <FilterBar @search={{search}} @properties={{PROPERTIES}} />
            <p data-test-ids>{{idsOf search.results}}</p>
          </Search>
        </template>,
      );
      assert
        .dom('[data-filter-key="owner"] [data-test-owner-input]')
        .hasValue('bo');
      assert.dom('[data-test-ids]').hasText('2,3');
    });
  },
);

module('Integration | QueryBuilder and view conditions', function (hooks) {
  setupRenderingTest(hooks);

  test('conditions owned by a view (view:*) are not shown', async function (assert) {
    const driver = new SearchDriver<Doc>({
      backend: memoryBackend(DOCS),
      idFactory: sequentialIds(),
    });
    driver.add('root', {
      kind: 'condition',
      id: 'view:calendar',
      field: 'score',
      operator: 'range',
      value: { gte: 50 },
    });
    await render(
      <template>
        <Search @driver={{driver}} as |search|>
          <QueryBuilder @search={{search}} @properties={{PROPERTIES}} />
          <p data-test-ids>{{idsOf search.results}}</p>
        </Search>
      </template>,
    );
    assert.dom(`${ROOT} > .sui-qb-children > li`).doesNotExist();
    assert.dom('[data-test-ids]').hasText('2,3', 'still applied');
    driver.destroy();
  });
});
