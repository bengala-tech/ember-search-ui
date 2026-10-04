import { module, test } from 'qunit';
import { click, findAll, select, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'docs/tests/helpers';
import { panelJson, truth } from '../helpers/server';
import type { Inspection } from 'docs/demo/data';

const request = () => panelJson('[data-test-request]');
const total = (n: number) => `${n} inspections`;
const texts = (selector: string) =>
  findAll(selector).map((el) => el.textContent?.trim() ?? '');

const done = (d: Inspection) => d.state === 'done';
const inMarch = (d: Inspection) => d.created_at.startsWith('2026-03');

module(
  'Acceptance | properties: one property list, every view',
  function (hooks) {
    setupApplicationTest(hooks);

    test('the table is built from the properties', async function (assert) {
      await visit('/examples/properties');
      assert.dom('[data-test-total]').hasText(total(36));
      assert.deepEqual(
        texts('[data-test-property-table] th').map((t) =>
          t.replace(/[▲▼]/, '').trim(),
        ),
        [
          'Title',
          'State',
          'Priority',
          'Project',
          'Created by',
          'Tags',
          'Cost',
          'Created',
          'Due',
        ],
        'Id is hidden from the table',
      );
      assert.dom('[data-test-row]').exists({ count: 8 });
      // a property link
      assert
        .dom('[data-test-row] td:first-child a')
        .hasAttribute('href', /^#inspection-\d+$/);

      // sorting through a property
      await click('[data-test-sort="title"]');
      assert.deepEqual(
        [request()['sort'], request()['sort_direction']],
        ['title', 'asc'],
      );
      assert
        .dom('[data-test-sort="created_by_id"]')
        .doesNotExist('sort: false');
    });

    test('legacy and new properties filter side by side', async function (assert) {
      await visit('/examples/properties');

      // the legacy State property: its own legacy picker, unchanged
      await select('[data-test-filter-bar] .sui-fb-add', 'state');
      await click('[data-test-legacy-state="done"]');
      assert.dom('[data-test-total]').hasText(total(truth(done)));
      assert.deepEqual(request()['filters'], { state: 'done' });
      // and its legacy listValue chip
      assert.dom('[data-test-state-badge]').hasText('State: done');

      // a Property without an editor: the built-in one
      await select('[data-test-filter-bar] .sui-fb-add', 'priority');
      await click(
        '[data-filter-key="priority"] .sui-qb-option:nth-child(3) input',
      );
      assert
        .dom('[data-test-total]')
        .hasText(total(truth((d) => done(d) && d.priority === 'high')));

      // the query builder shows the same conditions
      assert.dom('.advanced .sui-qb-condition').exists({ count: 2 });

      await click('[data-test-filter-bar] .sui-fb-clear');
      assert.dom('[data-test-total]').hasText(total(36));
    });

    test('the list and the calendar read the same properties', async function (assert) {
      await visit('/examples/properties');
      await click('[data-test-view="list"]');
      assert.dom('[data-test-card]').exists({ count: 8 });
      assert.dom('[data-test-card] h3 a').exists('the title property, linked');
      assert.dom('[data-test-card]:first-child dt').exists({ count: 5 });

      // the calendar narrows to its month with its own condition
      await select('[data-test-filter-bar] .sui-fb-add', 'state');
      await click('[data-test-legacy-state="done"]');
      await click('[data-test-view="calendar"]');
      assert.dom('[data-test-month]').hasText('March 2026');
      assert
        .dom('[data-test-calendar-item]')
        .exists({ count: truth((d) => done(d) && inMarch(d)) });
      assert
        .dom('[data-test-total]')
        .hasText(total(truth((d) => done(d) && inMarch(d))));
      assert
        .dom('.advanced .sui-qb-condition')
        .exists({ count: 1 }, 'the view condition is not a row');

      await click('[data-test-next]');
      assert.dom('[data-test-month]').hasText('April 2026');
      assert
        .dom('[data-test-total]')
        .hasText(
          total(truth((d) => done(d) && d.created_at.startsWith('2026-04'))),
        );

      // leaving the calendar removes its condition and restores the page size
      await click('[data-test-view="table"]');
      assert.dom('[data-test-total]').hasText(total(truth(done)));
      assert.strictEqual(request()['per'], 8);
    });

    test('export reads each property export', async function (assert) {
      await visit('/examples/properties');
      await click('[data-test-export]');
      const [header, first] = (
        document.querySelector('[data-test-csv]')?.textContent ?? ''
      ).split('\n');
      assert.strictEqual(
        header,
        'Title,State,Priority,Project,Created by,Tags,Cost,Created,Due,Id',
      );
      assert.ok(/^.+,\w+,\w+,/.test(first ?? ''), first);
    });
  },
);
