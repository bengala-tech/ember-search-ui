import { module, test } from 'qunit';
import { click, currentURL, fillIn, select, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'query-builder/tests/helpers';
import {
  createState,
  eq,
  and,
  materialize,
  sequentialIds,
  urlCodec,
  type GroupNode,
} from 'ember-search-ui-driver';
import { TEST_URL } from 'query-builder/demo/session';
import { panelJson, totalFor, truth } from '../helpers/prysmex';

const sent = () => panelJson('[data-test-sent]');
const row = (field: string) => `[data-test-filter="${field}"]`;

module('Acceptance | legacy Prysmex (list format)', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(() => {
    TEST_URL.value = '';
  });

  test('an untouched search sends an empty filter list', async function (assert) {
    await visit('/legacy');
    assert.strictEqual(currentURL(), '/legacy');
    assert.deepEqual(sent(), {
      filters: [],
      page: 1,
      per: 8,
      sort: 'created_at',
      sort_direction: 'desc',
    });
    assert.dom('[data-test-page]').hasText('Page 1 of 5 · 36 inspections');
  });

  test('filters built like Prysmex does today go out as the legacy list', async function (assert) {
    await visit('/legacy');

    // State is any of created, pending
    await select('[data-test-add-property]', 'state');
    await select(`${row('state')} [data-test-condition]`, 'any_of');
    await click(`${row('state')} [data-test-choice="created"]`);
    await click(`${row('state')} [data-test-choice="pending"]`);

    // AND cost between 1000 and 3000
    await select('[data-test-add-property]', 'cost');
    await select(`${row('cost')} [data-test-condition]`, 'between');
    await fillIn(`${row('cost')} [data-test-from]`, '1000');
    await fillIn(`${row('cost')} [data-test-to]`, '3000');

    // AND created by Bruno (id 2: a number on the wire, not "2")
    await select('[data-test-add-property]', 'created_by_id');
    await select(`${row('created_by_id')} [data-test-value]`, '2');

    assert.deepEqual(sent(), {
      filters: [
        { field: 'state', values: ['created', 'pending'] },
        { field: 'cost', values: [{ gte: 1000, lte: 3000 }] },
        { field: 'created_by_id', values: [2] },
      ],
      page: 1,
      per: 8,
      sort: 'created_at',
      sort_direction: 'desc',
    });

    const expected = truth(
      (d) =>
        ['created', 'pending'].includes(d.state) &&
        d.cost !== undefined &&
        d.cost >= 1000 &&
        d.cost <= 3000 &&
        d.created_by_id === 2,
    );
    assert.true(expected > 0, 'the example is not vacuous');
    assert.dom('[data-test-page]').includesText(`· ${expected} inspections`);
    assert.dom('[data-test-row]').exists({ count: Math.min(expected, 8) });
    assert
      .dom('[data-test-summary]')
      .hasText(
        'State is any of [created, pending] AND Cost is between 1000 and 3000 AND Created by is Bruno Díaz',
      );

    // The same internal state as the groups spec, and the server agrees on it
    const other = panelJson('[data-test-other]');
    assert.deepEqual(other['filters'], {
      state: ['created', 'pending'],
      cost: { gte: 1000, lte: 3000 },
      created_by_id: 2,
    });
    assert.strictEqual(await totalFor(other), expected);
    assert.strictEqual(await totalFor(sent()), expected);
  });

  test('sort, paging, text search and removing filters', async function (assert) {
    await visit('/legacy');
    await select('[data-test-add-property]', 'description');
    await fillIn(`${row('description')} [data-test-value]`, 'leak');
    await click('[data-test-sort="cost"]');
    assert.deepEqual(sent(), {
      filters: [{ field: 'description', values: ['leak'] }],
      page: 1,
      per: 8,
      sort: 'cost',
      sort_direction: 'asc',
    });
    const leaks = truth((d) => d.description.toLowerCase().includes('leak'));
    assert.dom('[data-test-page]').includesText(`· ${leaks} inspections`);

    await click('[data-test-next]');
    assert.strictEqual(sent()['page'], 2);

    await fillIn('[data-test-search]', 'rooftop');
    assert.strictEqual(sent()['search'], 'rooftop');
    assert.deepEqual(
      sent()['filters'],
      [{ field: 'description', values: ['leak'] }],
      'search keeps filters',
    );
    assert.strictEqual(sent()['page'], 1, 'a new search starts on page 1');

    await click(`${row('description')} [data-test-remove]`);
    assert.deepEqual(sent()['filters'], []);
  });

  test('restores filters from the URL', async function (assert) {
    const filter = materialize(
      {
        ...and({ ...eq('priority', 'high'), id: 'filter:priority' }),
        id: 'root',
      },
      sequentialIds(),
    ) as GroupNode;
    TEST_URL.value = `?${urlCodec({ prefix: 'legacy.' }).serialize(createState({ filter }))}`;
    await visit('/legacy');
    assert.dom(`${row('priority')} [data-test-value]`).hasValue('high');
    assert.deepEqual(sent()['filters'], [
      { field: 'priority', values: ['high'] },
    ]);
    assert
      .dom('[data-test-page]')
      .includesText(`· ${truth((d) => d.priority === 'high')} inspections`);
  });
});
