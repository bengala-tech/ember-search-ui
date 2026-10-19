import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  focus,
  render,
  settled,
  triggerKeyEvent,
} from '@ember/test-helpers';
import {
  ROOT_ID,
  SearchDriver,
  and,
  anyOf,
  defineProperty,
  disabled,
  eq,
  memoryBackend,
  named,
  not,
  or,
  range,
  sequentialIds,
  type NodeId,
  type NodeInput,
  type Option,
  type OptionsSource,
  type Scalar,
} from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import FilterPills from '#src/components/filter-pills.gts';

interface Doc {
  id: number;
  project: string;
  state: string;
  cost: number;
}
const DOCS: Doc[] = [
  { id: 1, project: 'a', state: 'open', cost: 100 },
  { id: 2, project: 'b', state: 'closed', cost: 5000 },
  { id: 3, project: 'a', state: 'closed', cost: 9000 },
];

const PROJECTS: Option[] = [
  { value: 'a', label: 'Plant A' },
  { value: 'b', label: 'Plant B' },
];

// a collection property: options come from a source, e.g. the store
const resolved: Scalar[][] = [];
const projectSource: OptionsSource = {
  load: () => Promise.resolve(PROJECTS),
  resolve: (values) => {
    resolved.push([...values]);
    return Promise.resolve(PROJECTS.filter((o) => values.includes(o.value)));
  },
};

const project = defineProperty<Doc>({
  label: 'Project',
  field: { path: 'project', type: 'keyword' },
  filter: { options: projectSource },
});
const state = defineProperty<Doc>({
  label: 'State',
  field: {
    path: 'state',
    type: 'keyword',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
});
const cost = defineProperty<Doc>({
  label: 'Cost',
  field: { path: 'cost', type: 'number' },
});
const PROPERTIES = [project, state, cost];

const pill = (n: number) => `.sui-fp-pill:nth-child(${n})`;
const texts = () =>
  [...document.querySelectorAll('.sui-fp-pill-text')].map((el) =>
    el.textContent?.trim(),
  );
const action = (name: string) => `.sui-fp-menu [data-pill-action="${name}"]`;
const idsOf = (results: readonly Doc[]) => results.map((r) => r.id).join(',');

module('Integration | Component | FilterPills', function (hooks) {
  setupRenderingTest(hooks);

  const ctx = {} as {
    driver: SearchDriver<Doc>;
    edited: NodeId[];
    onEdit: (id: NodeId) => void;
  };
  hooks.beforeEach(function () {
    resolved.length = 0;
    ctx.edited = [];
    ctx.onEdit = (id) => ctx.edited.push(id);
    ctx.driver = new SearchDriver<Doc>({
      backend: memoryBackend(DOCS),
      idFactory: sequentialIds(),
    });
  });
  hooks.afterEach(function () {
    ctx.driver.destroy();
  });

  const add = (...nodes: NodeInput[]) => {
    for (const node of nodes) ctx.driver.add(ROOT_ID, node);
  };

  const renderPills = (withEdit = false) =>
    withEdit
      ? render(
          <template>
            <Search @driver={{ctx.driver}} as |search|>
              <FilterPills
                @search={{search}}
                @properties={{PROPERTIES}}
                @onEdit={{ctx.onEdit}}
              />
              <p data-test-ids>{{idsOf search.results}}</p>
            </Search>
          </template>,
        )
      : render(
          <template>
            <Search @driver={{ctx.driver}} as |search|>
              <FilterPills @search={{search}} @properties={{PROPERTIES}} />
              <p data-test-ids>{{idsOf search.results}}</p>
            </Search>
          </template>,
        );

  test('one pill per root node: its label, else its description', async function (assert) {
    add(
      eq('state', 'open'),
      named('Expensive', range('cost', { gte: 3000 })),
      and(eq('state', 'closed'), range('cost', { gte: 1 })),
      or(eq('state', 'open'), eq('state', 'closed')),
    );
    await renderPills();
    assert.deepEqual(texts(), [
      'State: Open',
      'Expensive',
      '2 conditions',
      'any of 2 conditions',
    ]);
    assert.dom('.sui-fp-menu').doesNotExist();
  });

  test('NOT pills and switched off pills', async function (assert) {
    add(not(eq('state', 'open')), disabled(named('Cheap', eq('cost', 100))));
    await renderPills();
    assert.dom(`${pill(1)} .sui-fp-pill-text`).hasText('NOT State: Open');
    assert.dom(pill(1)).hasClass('is-negated');
    assert.dom(pill(2)).hasClass('is-disabled');
    assert.dom(`${pill(2)} .sui-fp-pill-text`).hasText('Cheap');
    assert.dom('[data-test-ids]').hasText('2,3');
  });

  test('the menu: exclude / include, disable / re-enable, delete', async function (assert) {
    add(eq('state', 'open'), range('cost', { gte: 3000 }));
    await renderPills();
    assert.dom('[data-test-ids]').hasText('');

    await click(`${pill(1)} .sui-fp-pill-text`);
    assert
      .dom(`${pill(1)} .sui-fp-pill-text`)
      .hasAttribute('aria-expanded', 'true');
    assert.dom(action('edit')).doesNotExist('no Edit without @onEdit');
    assert.dom(action('negate')).hasText('Exclude results');
    assert.dom(action('disable')).hasText('Temporarily disable');
    assert.dom(action('delete')).hasText('Delete');
    assert.dom(action('negate')).isFocused('focus moves into the menu');

    await click(action('negate'));
    assert.dom('.sui-fp-menu').doesNotExist('picking an item closes the menu');
    assert.dom(pill(1)).hasClass('is-negated');
    assert.dom('[data-test-ids]').hasText('2,3');

    await click(`${pill(1)} .sui-fp-pill-text`);
    assert.dom(action('negate')).hasText('Include results');
    await click(action('negate'));
    assert.dom(pill(1)).doesNotHaveClass('is-negated');

    await click(`${pill(1)} .sui-fp-pill-text`);
    await click(action('disable'));
    assert.dom(pill(1)).hasClass('is-disabled');
    assert.dom('[data-test-ids]').hasText('2,3');
    await click(`${pill(1)} .sui-fp-pill-text`);
    assert.dom(action('disable')).hasText('Re-enable');
    await click(action('disable'));
    assert.dom(pill(1)).doesNotHaveClass('is-disabled');

    await click(`${pill(1)} .sui-fp-pill-text`);
    await click(action('delete'));
    assert.deepEqual(texts(), ['Cost: is at least 3000']);
    assert.dom('[data-test-ids]').hasText('2,3');
  });

  test("the pill's × deletes it", async function (assert) {
    add(eq('state', 'open'), range('cost', { gte: 3000 }));
    await renderPills();
    await click(`${pill(2)} .sui-fp-pill-remove`);
    assert.deepEqual(texts(), ['State: Open']);
    assert
      .dom(`${pill(1)} .sui-fp-pill-remove`)
      .hasAttribute('aria-label', 'Delete filter: State: Open');
    await click(`${pill(1)} .sui-fp-pill-remove`);
    assert.dom('.sui-fp-pill').doesNotExist();
    assert.dom('[data-test-ids]').hasText('1,2,3');
  });

  test('Edit calls @onEdit with the node id', async function (assert) {
    add(eq('state', 'open'));
    await renderPills(true);
    const id = ctx.driver.state.filter.children[0]!.id;
    await click(`${pill(1)} .sui-fp-pill-text`);
    assert.dom(action('edit')).isFocused();
    await click(action('edit'));
    assert.deepEqual(ctx.edited, [id]);
    assert.dom('.sui-fp-menu').doesNotExist();
  });

  test('keyboard: arrows move, Escape closes and refocuses the pill', async function (assert) {
    add(eq('state', 'open'));
    await renderPills(true);
    await click(`${pill(1)} .sui-fp-pill-text`);
    await triggerKeyEvent('.sui-fp-menu', 'keydown', 'ArrowDown');
    assert.dom(action('negate')).isFocused();
    await triggerKeyEvent('.sui-fp-menu', 'keydown', 'ArrowUp');
    await triggerKeyEvent('.sui-fp-menu', 'keydown', 'ArrowUp');
    assert.dom(action('delete')).isFocused('wraps around');
    await triggerKeyEvent('.sui-fp-menu', 'keydown', 'Escape');
    assert.dom('.sui-fp-menu').doesNotExist();
    assert.dom(`${pill(1)} .sui-fp-pill-text`).isFocused();
  });

  test('focus leaving the pill closes its menu', async function (assert) {
    add(eq('state', 'open'), eq('state', 'closed'));
    await renderPills();
    await click(`${pill(1)} .sui-fp-pill-text`);
    assert.dom('.sui-fp-menu').exists();
    await focus(`${pill(2)} .sui-fp-pill-text`);
    assert.dom('.sui-fp-menu').doesNotExist();

    await click(`${pill(1)} .sui-fp-pill-text`);
    await click(`${pill(1)} .sui-fp-pill-text`);
    assert.dom('.sui-fp-menu').doesNotExist('clicking the pill again closes');
  });

  test('values on collection properties show option labels', async function (assert) {
    add(eq('project', 'a'), anyOf('project', ['a', 'b']), eq('project', 'z'));
    await renderPills();
    await settled();
    assert.deepEqual(texts(), [
      'Project: Plant A',
      'Project: Plant A, Plant B',
      'Project: z',
    ]);
    assert.deepEqual(
      resolved,
      [['a', 'b', 'z']],
      'each value is resolved once, in one call per field',
    );

    // a value set later is resolved then
    add(not(eq('project', 'b')));
    await settled();
    assert.dom(`${pill(4)} .sui-fp-pill-text`).hasText('NOT Project: Plant B');
    assert.strictEqual(
      resolved.length,
      1,
      'known values are not fetched again',
    );
  });
});
