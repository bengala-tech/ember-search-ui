import { module, test } from 'qunit';
import { click, fillIn, select, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'docs/tests/helpers';
import {
  createState,
  and,
  anyOf,
  eq,
  materialize,
  not,
  or,
  range,
  sequentialIds,
  urlCodec,
  type GroupNode,
} from 'ember-search-ui-driver';
import { TEST_URL } from 'docs/demo/session';
import { panelJson, totalFor, truth } from '../helpers/server';

const sent = () => panelJson('[data-test-sent]');

// QueryBuilder structure
const ROOT = '.sui-query-builder > .sui-qb-group';
const child = (parent: string, n: number) =>
  `${parent} > .sui-qb-children > li:nth-child(${n})`;
const group = (parent: string, n: number) =>
  `${child(parent, n)} > .sui-qb-group`;
const row = (parent: string, n: number) =>
  `${child(parent, n)} > .sui-qb-condition`;
const add = (parent: string, what: string) =>
  `${parent} > .sui-qb-footer [data-test-add="${what}"]`;

module('Acceptance | new (groups format)', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(() => {
    TEST_URL.value = '';
  });

  test('nested groups with NOT go out as the groups spec', async function (assert) {
    await visit('/examples/groups');

    // Match ANY of:
    await click(
      `${ROOT} > .sui-qb-header .sui-qb-segmented button:nth-child(2)`,
    );

    //   (State is any of created, pending AND Cost > 1000)
    await click(add(ROOT, 'group'));
    const first = group(ROOT, 1);
    await select(`${row(first, 1)} .sui-qb-field`, 'state');
    await select(`${row(first, 1)} .sui-qb-operator`, 'in');
    await click(`${row(first, 1)} .sui-qb-option:nth-child(1) input`); // created
    await click(`${row(first, 1)} .sui-qb-option:nth-child(2) input`); // pending
    await click(add(first, 'condition'));
    await select(`${row(first, 2)} .sui-qb-field`, 'cost');
    await select(`${row(first, 2)} .sui-qb-operator`, 'gt');
    await fillIn(`${row(first, 2)} .sui-qb-value input`, '1000');

    //   (NOT Priority is high AND Tags is any of safety)
    await click(add(ROOT, 'group'));
    const second = group(ROOT, 2);
    await select(`${row(second, 1)} .sui-qb-field`, 'priority');
    await select(`${row(second, 1)} .sui-qb-value select`, 'high');
    await click(`${row(second, 1)} .sui-qb-not`);
    await click(add(second, 'condition'));
    await select(`${row(second, 2)} .sui-qb-field`, 'tags');
    await select(`${row(second, 2)} .sui-qb-operator`, 'in');
    await click(`${row(second, 2)} .sui-qb-option:nth-child(1) input`); // safety

    assert
      .dom('[data-test-summary]')
      .hasText(
        '(State is any of [created, pending] AND Cost is greater than 1000) OR (NOT Priority is high AND Tags is any of [safety])',
      );
    assert.deepEqual(sent(), {
      filters: {
        type: 'any',
        filters: [
          { state: ['created', 'pending'], cost: { gt: 1000 } },
          {
            type: 'all',
            filters: [
              { __negate: true, priority: 'high' },
              { tags: ['safety'] },
            ],
          },
        ],
      },
      page: 1,
      per: 8,
      sort: 'created_at',
      sort_direction: 'desc',
    });

    const expected = truth(
      (d) =>
        (['created', 'pending'].includes(d.state) &&
          d.cost !== undefined &&
          d.cost > 1000) ||
        (d.priority !== 'high' && d.tags.includes('safety')),
    );
    assert.true(expected > 0, 'some inspections match');
    assert.true(expected < 36, 'not all inspections match');
    assert.dom('[data-test-page]').includesText(`· ${expected} inspections`);
    assert.strictEqual(await totalFor(sent()), expected);

    // The legacy list cannot say this; the page says why instead of guessing
    assert
      .dom('[data-test-refused]')
      .includesText('The list format can only AND conditions');
    assert.dom('[data-test-other]').doesNotExist();
  });

  test('a tree both formats can express: both requests give the same results', async function (assert) {
    await visit('/examples/groups');
    await click(add(ROOT, 'condition'));
    await select(`${row(ROOT, 1)} .sui-qb-field`, 'state');
    await select(`${row(ROOT, 1)} .sui-qb-value select`, 'done');
    await click(add(ROOT, 'condition'));
    await select(`${row(ROOT, 2)} .sui-qb-field`, 'due_at');
    await select(`${row(ROOT, 2)} .sui-qb-operator`, 'exists');

    assert.deepEqual(sent()['filters'], {
      state: 'done',
      due_at: { exists: true },
    });
    const legacy = panelJson('[data-test-other]');
    assert.deepEqual(legacy['filters'], [
      { field: 'state', values: ['done'] },
      { field: 'due_at', values: [{ exists: true }] },
    ]);
    const expected = truth((d) => d.state === 'done' && d.due_at !== null);
    assert.strictEqual(await totalFor(sent()), expected);
    assert.strictEqual(await totalFor(legacy), expected);
  });

  test('a NOT the legacy list cannot express is refused', async function (assert) {
    await visit('/examples/groups');
    await click(add(ROOT, 'condition'));
    await select(`${row(ROOT, 1)} .sui-qb-field`, 'state');
    await select(`${row(ROOT, 1)} .sui-qb-value select`, 'done');
    await click(`${row(ROOT, 1)} .sui-qb-not`);
    assert.deepEqual(sent()['filters'], { __negate: true, state: 'done' });
    assert
      .dom('[data-test-refused]')
      .includesText('The list format cannot negate');
    assert
      .dom('[data-test-page]')
      .includesText(`· ${truth((d) => d.state !== 'done')} inspections`);
  });

  test('restores a nested tree from the URL', async function (assert) {
    const filter = materialize(
      {
        ...and(
          or(
            and(
              anyOf('state', ['created', 'pending']),
              range('cost', { gt: 1000 }),
            ),
            not(eq('priority', 'high')),
          ),
        ),
        id: 'root',
      },
      sequentialIds(),
    ) as GroupNode;
    TEST_URL.value = `?${urlCodec({ prefix: 'groups.' }).serialize(createState({ filter }))}`;
    await visit('/examples/groups');
    assert
      .dom('[data-test-summary]')
      .hasText(
        '(State is any of [created, pending] AND Cost is greater than 1000) OR NOT Priority is high',
      );
    assert.deepEqual(sent()['filters'], {
      type: 'any',
      filters: [
        { state: ['created', 'pending'], cost: { gt: 1000 } },
        { __negate: true, priority: 'high' },
      ],
    });
    const expected = truth(
      (d) =>
        (['created', 'pending'].includes(d.state) &&
          d.cost !== undefined &&
          d.cost > 1000) ||
        d.priority !== 'high',
    );
    assert.dom('[data-test-page]').includesText(`· ${expected} inspections`);
  });
});
