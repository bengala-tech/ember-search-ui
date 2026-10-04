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
import { truth } from '../helpers/server';

// the guides, in reading order, and how many live demos each one has
const GUIDES = [
  { slug: 'getting-started', title: 'Getting started', demos: 1 },
  { slug: 'driver', title: 'The driver', demos: 1 },
  { slug: 'properties', title: 'Properties', demos: 1 },
  { slug: 'filtering', title: 'Filtering UIs', demos: 2 },
  { slug: 'views', title: 'Building views', demos: 1 },
  { slug: 'backends', title: 'Backends and codecs', demos: 0 },
  { slug: 'legacy-properties', title: 'Legacy properties', demos: 1 },
  {
    slug: 'migrating-from-search-ui',
    title: 'Migrating from a search-ui driver',
    demos: 0,
  },
];

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
      GUIDES.map((g) => g.title),
    );
    await click('[data-test-nav="examples"]');
    assert.strictEqual(currentURL(), '/examples');
    assert.dom('.intro a').exists({ count: 5 });
  });

  test('every guide renders, with its live demos', async function (assert) {
    for (const guide of GUIDES) {
      await visit(`/guides/${guide.slug}`);
      assert.dom('.docs-article h1').hasText(guide.title, guide.slug);
      assert
        .dom('[data-test-demo]')
        .exists({ count: guide.demos }, `${guide.slug}: its demos render`);
    }
  });

  test('each guide links to its source on GitHub', async function (assert) {
    const edit = 'https://github.com/bengala-tech/ember-search-ui/edit/main';
    await visit('/guides/filtering');
    assert
      .dom('[data-test-edit-page]')
      .hasAttribute('href', `${edit}/docs/guides/filtering.md`);
    // a guide that lives in a package links there
    await visit('/guides/migrating-from-search-ui');
    assert
      .dom('[data-test-edit-page]')
      .hasAttribute(
        'href',
        `${edit}/packages/ember-search-ui-driver/docs/migrating-from-search-ui.md`,
      );
  });

  test('links inside guides navigate in the app', async function (assert) {
    await visit('/guides/getting-started');
    await click('.docs-article a[href="/guides/driver"]');
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
});

module('Acceptance | API reference', function (hooks) {
  setupApplicationTest(hooks);

  test('lists every package and filters', async function (assert) {
    await visit('/api');
    assert.dom('[data-test-api-package]').exists({ count: 3 });
    await fillIn('[data-test-api-filter]', 'defineProperty');
    assert.dom('[data-test-api-entry]').exists({ count: 1 });
    await click('[data-test-api-entry="defineProperty"] a');
    assert.strictEqual(currentURL(), '/guides/properties');
  });
});

module('Acceptance | query inspector', function (hooks) {
  setupApplicationTest(hooks);

  test('shows the demo search in every format', async function (assert) {
    await visit('/guides/driver');
    await click('[data-test-tree-add]');
    await click('[data-test-demo="driver-tree"] [data-test-show-query]');
    assert.dom('[data-test-inspector]').exists();

    // groups: the OR group as the documented spec
    assert.dom('[data-test-inspector-output]').includesText('"type": "any"');
    assert.dom('[data-test-inspector-output]').includesText('"state": "done"');

    // the legacy list cannot express OR: refused, with the reason
    await click('[data-test-inspector-tab="list"]');
    assert.dom('[data-test-inspector-output]').hasClass('is-refused');
    assert
      .dom('[data-test-inspector-output]')
      .includesText('can only AND conditions');

    await click('[data-test-inspector-tab="state"]');
    assert.dom('[data-test-inspector-output]').includesText('"op": "or"');

    await click('[data-test-inspector-tab="url"]');
    assert.dom('[data-test-inspector-output]').includesText('?f=');

    await click('[data-test-inspector-close]');
    assert.dom('[data-test-inspector]').doesNotExist();
  });
});
