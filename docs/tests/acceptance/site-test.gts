import { module, test } from 'qunit';
import {
  click,
  currentURL,
  fillIn,
  findAll,
  select,
  visit,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'docs/tests/helpers';
import { GUIDES } from 'docs/guides/index';
import { truth } from '../helpers/server';

const texts = (selector: string) =>
  findAll(selector).map((el) => el.textContent?.trim() ?? '');
const searchable = (term: string) =>
  truth((d) =>
    [d.title, d.description, d.project].some((t) =>
      t.toLowerCase().includes(term),
    ),
  );

module('Acceptance | docs site', function (hooks) {
  setupApplicationTest(hooks);

  test('home leads to the guides and the examples', async function (assert) {
    await visit('/');
    assert.dom('.home h1').exists();
    await click('.cta a:first-child');
    assert.strictEqual(currentURL(), '/guides/getting-started');
    assert.deepEqual(
      texts('.docs-nav a'),
      GUIDES.map((g) => g.doc.title),
    );
    await click('[data-test-nav="examples"]');
    assert.strictEqual(currentURL(), '/examples');
    assert.dom('.intro a').exists({ count: 5 });
  });

  test('every guide renders, with its demos where its markers are', async function (assert) {
    for (const guide of GUIDES) {
      await visit(`/guides/${guide.slug}`);
      assert.dom('.docs-article h1').hasText(guide.doc.title, guide.slug);
      const markers = [
        ...guide.doc.html.matchAll(/<!--\s*demo:([\w-]+)\s*-->/g),
      ].map((m) => m[1]);
      assert.deepEqual(
        texts('[data-test-demo]').length,
        markers.length,
        `${guide.slug}: one demo per marker`,
      );
      for (const name of markers)
        assert.ok(guide.demos?.[name!], `${guide.slug}: demo ${name} exists`);
    }
  });

  test('links inside guides navigate in the app', async function (assert) {
    await visit('/guides/getting-started');
    await click('.prose a[href="/guides/driver"]');
    assert.strictEqual(currentURL(), '/guides/driver');
    assert.dom('.docs-nav a.active').hasText('The driver');
    assert.dom('.docs-toc a[href="#the-filter-tree"]').exists();
    await click('.docs-next');
    assert.strictEqual(currentURL(), '/guides/properties');
  });

  test('getting started: the quick start searches and pages', async function (assert) {
    await visit('/guides/getting-started');
    assert.dom('[data-test-quick-total]').hasText('36 inspections');
    assert.dom('[data-test-quick-results] li').exists({ count: 5 });
    await fillIn('[data-test-quick-search]', 'roof');
    assert
      .dom('[data-test-quick-total]')
      .hasText(`${searchable('roof')} inspections`);
    await fillIn('[data-test-quick-search]', '');
    await click('[data-test-quick-next]');
    assert.dom('[data-test-quick-page]').hasText('page 2 of 8');
  });

  test('the driver guide builds a tree with commands', async function (assert) {
    await visit('/guides/driver');
    const either = (d: { state: string; priority: string; project: string }) =>
      d.state === 'done' ||
      (d.priority === 'high' && d.project === 'Monterrey plant');
    await click('[data-test-tree-add]');
    assert.dom('[data-test-tree-total]').hasText(String(truth(either)));
    await click('[data-test-tree-negate]');
    assert
      .dom('[data-test-tree-total]')
      .hasText(String(truth((d) => !either(d))));
    assert.dom('[data-test-tree-text]').includesText('NOT');
    await click('[data-test-tree-disable]');
    assert
      .dom('[data-test-tree-total]')
      .hasText('36', 'switched off: no effect');
  });

  test('the views guide: a kanban follows the filter bar', async function (assert) {
    await visit('/guides/views');
    const lanes = () =>
      ['low', 'medium', 'high'].map(
        (p) => findAll(`[data-test-column="${p}"] .kanban-card`).length,
      );
    assert.deepEqual(lanes(), [
      truth((d) => d.priority === 'low'),
      truth((d) => d.priority === 'medium'),
      truth((d) => d.priority === 'high'),
    ]);
    await select('.sui-fb-add', 'state');
    await click('[data-test-legacy-state="done"]');
    assert.deepEqual(lanes(), [
      truth((d) => d.state === 'done' && d.priority === 'low'),
      truth((d) => d.state === 'done' && d.priority === 'medium'),
      truth((d) => d.state === 'done' && d.priority === 'high'),
    ]);
  });

  test('the filtering guide: filter bar and query builder demos', async function (assert) {
    await visit('/guides/filtering');
    await select('[data-test-demo="filter-bar"] .sui-fb-add', 'priority');
    await click(
      '[data-test-demo="filter-bar"] [data-filter-key="priority"] .sui-qb-option:nth-child(3) input',
    );
    assert
      .dom('[data-test-bar-total]')
      .hasText(`${truth((d) => d.priority === 'high')} inspections`);

    await click(
      '[data-test-demo="query-builder"] .sui-qb-footer [data-test-add="condition"]',
    );
    assert.deepEqual(
      texts('[data-test-demo="query-builder"] .sui-qb-field option').slice(
        0,
        3,
      ),
      ['Title', 'State', 'Priority'],
    );
  });

  test('an unknown guide shows the first one', async function (assert) {
    await visit('/guides/nope');
    assert
      .dom('[data-test-guide]')
      .hasAttribute('data-test-guide', 'getting-started');
  });
});
