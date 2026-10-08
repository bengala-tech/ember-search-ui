import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { clearRender, click, render, settled } from '@ember/test-helpers';
import { on } from '@ember/modifier';
import { destroy } from '@ember/destroyable';
import {
  SearchDriver,
  and,
  eq,
  memoryBackend,
  memoryHistory,
  not,
  or,
  sequentialIds,
  urlCodec,
  withId,
} from 'ember-search-ui-driver';
import Search from '#src/components/search.gts';
import { TrackedSearch, trackSearch } from '#src/tracked-search.ts';
import { Box } from '../../helpers/tracked-box.ts';

interface Doc {
  id: number;
  x: string;
  u: string;
  t: string;
}

const DOCS: Doc[] = [
  { id: 1, x: 'b', u: 'k', t: 'z' },
  { id: 2, x: 'c', u: 'z', t: 'k' },
  { id: 3, x: 'b', u: 'z', t: 'k' },
  { id: 4, x: 'c', u: 'k', t: 'z' },
  { id: 5, x: 'b', u: 'k', t: 'k' },
  { id: 6, x: 'a', u: 'k', t: 'k' },
];

const newDriver = () =>
  new SearchDriver<Doc>({
    backend: memoryBackend(DOCS),
    idFactory: sequentialIds(),
  });

const idsOf = (results: readonly Doc[]) => results.map((r) => r.id).join(',');

module('Integration | Component | Search (new driver)', function (hooks) {
  setupRenderingTest(hooks);

  test('it yields tracked results; settled() waits for searches', async function (assert) {
    const driver = newDriver();
    await render(
      <template>
        <Search @driver={{driver}} as |search|>
          <span data-test-status>{{search.result.status}}</span>
          <span data-test-ids>{{idsOf search.results}}</span>
          <span data-test-total>{{search.total}}</span>
        </Search>
      </template>,
    );
    assert.dom('[data-test-ids]').hasText('1,2,3,4,5,6');
    assert.dom('[data-test-status]').hasText('success');

    // (x is b and u is k) or (t is k and x is c)
    driver.add(
      'root',
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    );
    await settled();
    assert.dom('[data-test-ids]').hasText('1,2,5');
    assert.dom('[data-test-total]').hasText('3');
    driver.destroy();
  });

  test('commands from the template update everything that reads the tree', async function (assert) {
    const driver = newDriver();
    driver.add(
      'root',
      or(
        withId('first', and(eq('x', 'b'), eq('u', 'k'))),
        withId('second', and(eq('t', 'k'), eq('x', 'c'))),
      ),
    );
    const toggleFirst = () => driver.toggleNegate('first');
    await render(
      <template>
        <Search @driver={{driver}} as |search|>
          {{#let (search.node "first") as |first|}}
            <span data-test-negated>{{if first.negate "NOT" "-"}}</span>
          {{/let}}
          <span data-test-ids>{{idsOf search.results}}</span>
          <button type="button" {{on "click" toggleFirst}}>toggle</button>
        </Search>
      </template>,
    );
    assert.dom('[data-test-ids]').hasText('1,2,5');
    await click('button');
    assert.dom('[data-test-negated]').hasText('NOT');
    assert.dom('[data-test-ids]').hasText('2,3,4,6');
    driver.destroy();
  });

  test('@config creates a driver it owns and destroys', async function (assert) {
    const backend = memoryBackend(DOCS);
    let driver: SearchDriver<Doc> | undefined;
    const capture = (search: TrackedSearch<Doc>) => {
      driver = search.driver;
    };
    const config = {
      backend,
      initialState: { sort: [{ field: 'id', direction: 'desc' as const }] },
    };
    await render(
      <template>
        <Search @config={{config}} as |search|>
          {{capture search}}
          <span data-test-ids>{{idsOf search.results}}</span>
        </Search>
      </template>,
    );
    assert.dom('[data-test-ids]').hasText('6,5,4,3,2,1');
    driver!.add('root', not(eq('x', 'b')));
    await settled();
    assert.dom('[data-test-ids]').hasText('6,4,2');

    let searched = 0;
    driver!.subscribe(() => searched++);
    await clearRender();
    driver!.add('root', eq('x', 'a'));
    await settled();
    assert.strictEqual(searched, 0, 'the owned driver was destroyed');
  });

  test('a @driver passed in is not destroyed, and swapping it reconnects', async function (assert) {
    const first = newDriver();
    const second = new SearchDriver<Doc>({
      backend: memoryBackend(DOCS.slice(0, 2)),
    });
    const current = new Box(first);
    await render(
      <template>
        <Search @driver={{current.value}} as |search|>
          <span data-test-ids>{{idsOf search.results}}</span>
        </Search>
      </template>,
    );
    assert.dom('[data-test-ids]').hasText('1,2,3,4,5,6');
    current.value = second;
    await settled();
    assert.dom('[data-test-ids]').hasText('1,2');

    await clearRender();
    first.add('root', eq('x', 'b'));
    await first.settled();
    assert.strictEqual(
      first.result.total,
      3,
      'the passed-in driver still works',
    );
    first.destroy();
    second.destroy();
  });

  test('config.syncUrl restores from the URL and writes changes back', async function (assert) {
    const codec = urlCodec();
    const source = newDriver();
    source.add('root', or(eq('x', 'a'), eq('x', 'c')));
    const history = memoryHistory(`?${codec.serialize(source.state)}&tab=1`);
    source.destroy();

    const driver = newDriver();
    const config = { syncUrl: { adapter: history, debounceMs: 0 } };
    await render(
      <template>
        <Search @driver={{driver}} @config={{config}} as |search|>
          <span data-test-ids>{{idsOf search.results}}</span>
        </Search>
      </template>,
    );
    assert.dom('[data-test-ids]').hasText('2,4,6', 'restored from the URL');

    driver.setPage(1);
    driver.setQuery('b');
    await settled();
    assert.true(history.read().includes('q=b'));
    assert.true(history.read().includes('tab=1'), 'unrelated params kept');

    await clearRender();
    driver.setQuery('c');
    await settled();
    assert.false(
      history.read().includes('q=c'),
      'sync stopped with the component',
    );
    driver.destroy();
  });

  test('URL synchronization is off by default and when explicitly false', async function (assert) {
    const driver = newDriver();
    const originalUrl = window.location.href;
    for (const config of [{}, { syncUrl: false }]) {
      await render(
        <template>
          <Search @driver={{driver}} @config={{config}} as |search|>
            <span>{{search.total}}</span>
          </Search>
        </template>,
      );
      driver.setQuery('unchanged-url');
      await settled();
      assert.strictEqual(window.location.href, originalUrl);
      await clearRender();
      driver.setQuery('');
    }
    driver.destroy();
  });

  test('trackSearch unsubscribes without destroying a shared driver by default', async function (assert) {
    const driver = newDriver();
    const owner = {};
    const search = trackSearch(owner, driver);
    await settled();
    destroy(owner);
    await settled();
    driver.add('root', eq('x', 'b'));
    await driver.settled();
    assert.strictEqual(search.total, 6, 'the wrapper stopped updating');
    assert.strictEqual(
      driver.result.total,
      3,
      'the shared driver still searches',
    );
    driver.destroy();
  });

  test('trackSearch ties a TrackedSearch to an owner', async function (assert) {
    const driver = newDriver();
    const owner = {};
    const search = trackSearch(owner, driver, { destroyDriver: true });
    await settled();
    assert.strictEqual(search.total, 6);
    driver.add('root', eq('u', 'k'));
    await settled();
    assert.strictEqual(search.total, 4);
    destroy(owner);
    await settled();
    driver.add('root', eq('x', 'b'));
    await settled();
    assert.strictEqual(search.total, 4, 'disconnected');
    assert.strictEqual(driver.result.total, 4, 'and the driver was destroyed');
  });
});
