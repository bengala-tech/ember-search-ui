import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, settled } from '@ember/test-helpers';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import Component from '@glimmer/component';
import type { TOC } from '@ember/component/template-only';
import type Owner from '@ember/owner';
import {
  SearchDriver,
  defineProperty,
  memoryBackend,
  searchUiCompat,
  type LegacyProperty,
} from 'ember-search-ui-driver';
import PropertyFilter from '#src/components/properties/property-filter.gts';
import PropertyChip from '#src/components/properties/property-chip.gts';
import { TrackedSearch } from '#src/tracked-search.ts';
import type {
  FilterChipSignature,
  FilterEditorSignature,
} from '#src/properties.ts';
import type { LegacyFilterComponentArgs } from '#src/components/properties/legacy-filter-editor.gts';
import type { LegacyListValuesArgs } from '#src/components/properties/legacy-filter-chip.gts';

interface Doc {
  id: number;
  state: string;
}
const DOCS: Doc[] = [
  { id: 1, state: 'open' },
  { id: 2, state: 'closed' },
  { id: 3, state: 'open' },
  { id: 4, state: 'draft' },
];

const json = (value: unknown) => JSON.stringify(value) ?? '';
const orNoop = (callback?: () => void) => callback ?? (() => {});
const ids = (search: TrackedSearch<Doc>) =>
  search.results.map((d) => d.id).join(',');
const target = (event: Event) => (event.target as HTMLInputElement).value;

// --- a new-style editor and chip -------------------------------------------------

const StateEditor: TOC<FilterEditorSignature> = <template>
  <span data-test-editor-value>{{json @node.value}}</span>
  <button
    type="button"
    data-test-open
    {{on "click" (fn @update (hash1 "open"))}}
  >open</button>
  <button type="button" data-test-remove {{on "click" @remove}}>remove</button>
</template>;
function hash1(value: string) {
  return { value };
}

const StateChip: TOC<FilterChipSignature> = <template>
  <span data-test-chip>{{@property.label}}: {{json @node.value}}</span>
  <button type="button" data-test-chip-remove {{on "click" @remove}}>x</button>
</template>;

const modernState = defineProperty<Doc>({
  label: 'State',
  field: { path: 'state', type: 'keyword' },
  filter: { editor: StateEditor, chip: StateChip },
});

// --- legacy components, recording what they receive ---------------------------

const received: LegacyFilterComponentArgs[] = [];

class LegacyStatePicker extends Component<{ Args: LegacyFilterComponentArgs }> {
  constructor(owner: Owner, args: LegacyFilterComponentArgs) {
    super(owner, args);
    received.push(args);
  }
  pick = (event: Event) => {
    const raw = target(event);
    // pickers often hand back { value, label } objects
    this.args.onChange(
      raw ? raw.split(',').map((value) => ({ value, label: value })) : '',
    );
  };
  <template>
    <span data-test-legacy-name>{{@property.name}}</span>
    <span data-test-legacy-config>{{json @config}}</span>
    <span data-test-legacy-value>{{json @value}}</span>
    <input data-test-legacy-input {{on "change" this.pick}} />
  </template>
}

const ListValues: TOC<{ Args: LegacyListValuesArgs }> = <template>
  <span data-test-list-values>{{@property.name}}
    {{json @value}}
    {{json @config}}</span>
  <button
    type="button"
    data-test-clear
    {{on "click" (orNoop @onClearFilter)}}
  >clear</button>
</template>;

const ListValue: TOC<{ Args: LegacyListValuesArgs }> = <template>
  <span data-test-list-value>{{json @value}}</span>
</template>;

class LegacyProp implements LegacyProperty {
  name = '';
  valuePath = '';
  componentsForFiltering: LegacyProperty['componentsForFiltering'] = {};
  constructor(config: Partial<LegacyProp>) {
    Object.assign(this, config);
  }
  get filteredBy() {
    return this.valuePath;
  }
  get useFilter() {
    return Boolean(this.filteredBy);
  }
}

module('Integration | properties: filter editors and chips', function (hooks) {
  setupRenderingTest(hooks);

  // a const object: templates may not read reassigned variables
  const ctx = {} as { driver: SearchDriver<Doc>; search: TrackedSearch<Doc> };
  hooks.beforeEach(function () {
    received.length = 0;
    ctx.driver = new SearchDriver<Doc>({ backend: memoryBackend(DOCS) });
    ctx.search = new TrackedSearch(ctx.driver);
  });
  hooks.afterEach(function () {
    ctx.search.disconnect();
    ctx.driver.destroy();
  });

  test('a property editor and chip edit the filter-bar condition', async function (assert) {
    await render(
      <template>
        <PropertyFilter @search={{ctx.search}} @property={{modernState}} />
        <PropertyChip @search={{ctx.search}} @property={{modernState}} />
        <span data-test-ids>{{ids ctx.search}}</span>
      </template>,
    );
    assert.dom('[data-test-chip]').doesNotExist('no chip without a filter');
    await click('[data-test-open]');
    assert.dom('[data-test-ids]').hasText('1,3');
    assert.dom('[data-test-editor-value]').hasText('"open"');
    assert.dom('[data-test-chip]').hasText('State: "open"');
    await click('[data-test-chip-remove]');
    assert.dom('[data-test-ids]').hasText('1,2,3,4');
    assert.dom('[data-test-chip]').doesNotExist();
  });

  test('a legacy filter component runs unchanged', async function (assert) {
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      componentsForFiltering: {
        filter: { component: LegacyStatePicker, args: { multiple: true } },
      },
    });
    const compat = searchUiCompat(ctx.driver, { arrays: 'keep' });
    compat.setFilter('state', ['open', 'closed'], 'any');
    await render(
      <template>
        <PropertyFilter
          @search={{ctx.search}}
          @property={{legacy}}
          @arrays="keep"
        />
        <span data-test-ids>{{ids ctx.search}}</span>
      </template>,
    );
    // the original object, its args as @config, and the value setFilter got
    assert.strictEqual(received[0]?.property, legacy);
    assert.dom('[data-test-legacy-name]').hasText('State');
    assert.dom('[data-test-legacy-config]').hasText('{"multiple":true}');
    assert.dom('[data-test-legacy-value]').hasText('["open","closed"]');
    assert.dom('[data-test-ids]').hasText('1,2,3');

    // { value } objects are unwrapped, as the legacy container does
    await fillIn('[data-test-legacy-input]', 'draft');
    assert.dom('[data-test-ids]').hasText('4');
    assert.dom('[data-test-legacy-value]').hasText('["draft"]');
    assert.deepEqual(compat.getState().filters, [
      { field: 'state', values: [['draft']], type: 'any' },
    ]);

    // a blank value removes the filter
    await fillIn('[data-test-legacy-input]', '');
    assert.dom('[data-test-ids]').hasText('1,2,3,4');
    assert.deepEqual(compat.getState().filters, []);
  });

  test('legacy editors can keep a draft until Apply', async function (assert) {
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      componentsForFiltering: { filter: { component: LegacyStatePicker } },
    });
    await render(
      <template>
        <PropertyFilter
          @search={{ctx.search}}
          @property={{legacy}}
          @applyOnChange={{false}}
          as |filter|
        >
          <span data-test-dirty>{{if filter.isDirty "dirty" "clean"}}</span>
          <button
            type="button"
            data-test-apply
            {{on "click" (orNoop filter.apply)}}
          >Apply</button>
          <button
            type="button"
            data-test-remove
            {{on "click" filter.remove}}
          >Remove</button>
        </PropertyFilter>
        <span data-test-ids>{{ids ctx.search}}</span>
      </template>,
    );
    await fillIn('[data-test-legacy-input]', 'open,draft');
    assert.dom('[data-test-ids]').hasText('1,2,3,4', 'not applied yet');
    assert.dom('[data-test-dirty]').hasText('dirty');
    assert.dom('[data-test-legacy-value]').hasText('["open","draft"]');
    await click('[data-test-apply]');
    assert.dom('[data-test-ids]').hasText('1,3,4');
    assert.dom('[data-test-dirty]').hasText('clean');
    await click('[data-test-remove]');
    assert.dom('[data-test-ids]').hasText('1,2,3,4');
  });

  test('shouldShow false hides a legacy editor', async function (assert) {
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      componentsForFiltering: {
        filter: { component: LegacyStatePicker, shouldShow: () => false },
      },
    });
    await render(
      <template>
        <PropertyFilter @search={{ctx.search}} @property={{legacy}} />
      </template>,
    );
    assert.dom('[data-test-legacy-input]').doesNotExist();
  });

  test('without an editor the block builds one', async function (assert) {
    const plain = defineProperty<Doc>({
      label: 'State',
      field: { path: 'state', type: 'keyword' },
    });
    const draftOnly = { value: 'draft' };
    await render(
      <template>
        <PropertyFilter @search={{ctx.search}} @property={{plain}} as |filter|>
          <button
            type="button"
            data-test-set
            {{on "click" (fn filter.update draftOnly)}}
          >
            {{filter.property.label}}
          </button>
        </PropertyFilter>
        <PropertyChip @search={{ctx.search}} @property={{plain}} as |chip|>
          <span data-test-fallback-chip>{{chip.property.label}}
            {{json chip.values}}</span>
        </PropertyChip>
        <span data-test-ids>{{ids ctx.search}}</span>
      </template>,
    );
    assert.dom('[data-test-set]').hasText('State');
    await click('[data-test-set]');
    assert.dom('[data-test-ids]').hasText('4');
    assert.dom('[data-test-fallback-chip]').hasText('State ["draft"]');
  });

  test('legacy listValues gets filter.values and can clear', async function (assert) {
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      componentsForFiltering: {
        listValues: { component: ListValues, args: { compact: true } },
      },
    });
    searchUiCompat(ctx.driver, { arrays: 'keep' }).setFilter(
      'state',
      ['open', 'closed'],
      'any',
    );
    await render(
      <template>
        <PropertyChip @search={{ctx.search}} @property={{legacy}} />
        <span data-test-ids>{{ids ctx.search}}</span>
      </template>,
    );
    assert
      .dom('[data-test-list-values]')
      .hasText('State [["open","closed"]] {"compact":true}');
    await click('[data-test-clear]');
    assert.dom('[data-test-list-values]').doesNotExist();
    assert.dom('[data-test-ids]').hasText('1,2,3,4');
  });

  test('legacy listValue renders once per value', async function (assert) {
    const legacy = new LegacyProp({
      name: 'State',
      valuePath: 'state',
      componentsForFiltering: { listValue: { component: ListValue } },
    });
    searchUiCompat(ctx.driver).setFilter('state', ['open', 'closed'], 'any');
    await render(
      <template>
        <PropertyChip @search={{ctx.search}} @property={{legacy}} />
      </template>,
    );
    assert.dom('[data-test-list-value]').exists({ count: 2 });
    assert.dom('[data-test-list-value]:first-child').hasText('"open"');
    await settled();
  });
});
