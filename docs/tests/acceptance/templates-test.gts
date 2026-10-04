import { module, test } from 'qunit';
import { click, currentURL, find, select, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'docs/tests/helpers';
import { TEST_URL } from 'docs/demo/session';
import { truth } from '../helpers/server';

const lastRequest = () =>
  JSON.parse(find('[data-test-last-request]')!.textContent) as Record<
    string,
    unknown
  >;
const totalText = (n: number) => `${n} results`;

module('Acceptance | template: legacy drop-in', function (hooks) {
  setupApplicationTest(hooks);

  test('the unchanged template searches and sends the legacy list', async function (assert) {
    await visit('/examples/templates/legacy');
    assert.dom('[data-test-total]').hasText(totalText(36));
    assert.dom('[data-test-paging-info]').hasText('1–10 of 36');
    assert.deepEqual(lastRequest(), { filters: [], page: 1, per: 10 });

    // a direct driver.setFilter(...) call, like the calendar's
    await click('[data-test-only-pending]');
    const pending = truth((d) => d.state === 'pending');
    assert.dom('[data-test-total]').hasText(totalText(pending));
    assert.deepEqual(lastRequest(), {
      filters: [{ field: 'state', values: ['pending'] }],
      page: 1,
      per: 10,
    });
    // mapContextToProps "filters" shows the search-ui filters
    assert.dom('[data-test-filters]').includesText('"field": "state"');
  });

  test('Date objects (like a calendar sets) go out as ISO strings', async function (assert) {
    await visit('/examples/templates/legacy');
    await click('[data-test-march]');
    assert.deepEqual(lastRequest()['filters'], [
      {
        field: 'created_at',
        values: [
          {
            gte: '2026-03-01T00:00:00.000Z',
            lte: '2026-03-31T23:59:59.999Z',
          },
        ],
      },
    ]);
    const march = truth((d) => d.created_at.startsWith('2026-03'));
    assert.dom('[data-test-total]').hasText(totalText(march));
  });

  test('sorting and paging containers', async function (assert) {
    await visit('/examples/templates/legacy');
    await click('[data-test-sort-oldest]');
    await click('[data-test-next]');
    assert.dom('[data-test-page]').hasText('2 / 4');
    assert.deepEqual(lastRequest(), {
      filters: [],
      sort: 'created_at',
      sort_direction: 'asc',
      page: 2,
      per: 10,
    });
  });

  test('export to Excel: serializeState + makeSearch to another endpoint', async function (assert) {
    await visit('/examples/templates/legacy');
    await click('[data-test-only-pending]');
    await click('[data-test-export]');
    assert
      .dom('[data-test-last-endpoint]')
      .hasText('api/inspections/search.xlsx');
    assert.deepEqual(lastRequest(), {
      filters: [{ field: 'state', values: ['pending'] }],
      page: 1,
      per: 5000,
    });
  });

  test('the `query` param is written and read back on load', async function (assert) {
    await visit('/examples/templates/legacy');
    await click('[data-test-only-pending]');
    const query = find('[data-test-query]')!.textContent;
    assert.deepEqual(JSON.parse(query), {
      current: 1,
      resultsPerPage: 10,
      searchTerm: '',
      sortField: '',
      sortDirection: '',
      filters: [{ field: 'state', values: ['pending'] }],
    });
    assert.true(currentURL().includes('query='), 'kept in the URL');
  });
});

module('Acceptance | template: legacy drop-in, restored', function (hooks) {
  setupApplicationTest(hooks);

  test('a saved `query` param restores the search', async function (assert) {
    const query = JSON.stringify({
      current: 1,
      resultsPerPage: 10,
      filters: [{ field: 'state', values: ['done'] }],
    });
    await visit(
      `/examples/templates/legacy?query=${encodeURIComponent(query)}`,
    );
    assert.deepEqual(lastRequest()['filters'], [
      { field: 'state', values: ['done'] },
    ]);
    assert
      .dom('[data-test-total]')
      .hasText(totalText(truth((d) => d.state === 'done')));
  });
});

module('Acceptance | template: new groups spec', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(() => {
    TEST_URL.value = '';
  });

  const ROOT = '.sui-query-builder > .sui-qb-group';
  const row = (n: number) =>
    `${ROOT} > .sui-qb-children > li:nth-child(${n}) > .sui-qb-condition`;
  const addCondition = `${ROOT} > .sui-qb-footer [data-test-add="condition"]`;

  test('an OR from the QueryBuilder goes out as the groups spec; WithSearch views see the same results', async function (assert) {
    await visit('/examples/templates/groups');
    assert.dom('[data-test-total]').hasText(totalText(36));

    // Match ANY of: State is done, Priority is high
    await click(
      `${ROOT} > .sui-qb-header .sui-qb-segmented button:nth-child(2)`,
    );
    await click(addCondition);
    await select(`${row(1)} .sui-qb-field`, 'state');
    await select(`${row(1)} .sui-qb-value select`, 'done');
    await click(addCondition);
    await select(`${row(2)} .sui-qb-field`, 'priority');
    await select(`${row(2)} .sui-qb-value select`, 'high');

    const expected = truth((d) => d.state === 'done' || d.priority === 'high');
    assert.dom('[data-test-total]').hasText(totalText(expected));
    assert
      .dom('[data-test-with-search-total]')
      .hasText(`WithSearch sees ${expected} results`);
    assert.deepEqual(lastRequest()['filters'], {
      type: 'any',
      filters: [{ state: 'done' }, { priority: 'high' }],
    });

    // the old export path sends the same groups filters
    await click('[data-test-export]');
    assert
      .dom('[data-test-last-endpoint]')
      .hasText('api/inspections/search.xlsx');
    assert.deepEqual(lastRequest()['filters'], {
      type: 'any',
      filters: [{ state: 'done' }, { priority: 'high' }],
    });
    assert.strictEqual(lastRequest()['per'], 5000);
  });
});
