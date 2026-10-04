import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  clearRender,
  find,
  render,
  settled,
  waitUntil,
} from '@ember/test-helpers';
import type { SearchDriver } from '@elastic/search-ui';
import SearchProvider from '#src/components/search-provider.gts';
import WithSearch from '#src/components/with-search.gts';
import mapContextToProps from '#src/helpers/map-context-to-props.ts';
import type { SearchProviderConfig } from '#src/types.ts';
import { buildConfig, createDriver } from '../../helpers/search.ts';
import { Box } from '../../helpers/tracked-box.ts';

const eq = (a: unknown, b: unknown) => a === b;

module('Integration | Component | search-provider', function (hooks) {
  setupRenderingTest(hooks);

  test('it creates a driver from @config and yields it', async function (assert) {
    const config = buildConfig();
    await render(
      <template>
        <SearchProvider @config={{config}} as |driver|>
          <WithSearch
            @driver={{driver}}
            @mapContextToProps={{mapContextToProps "totalResults"}}
            as |state|
          >
            <span data-test-total>{{state.totalResults}}</span>
          </WithSearch>
        </SearchProvider>
      </template>,
    );

    await waitUntil(() => find('[data-test-total]')?.textContent === '5');
    assert.dom('[data-test-total]').hasText('5');
  });

  test('it yields the @driver it was given', async function (assert) {
    const driver = createDriver();
    await render(
      <template>
        <SearchProvider @driver={{driver}} as |yielded|>
          {{#if (eq yielded driver)}}<span data-test-same>same</span>{{/if}}
        </SearchProvider>
      </template>,
    );
    assert.dom('[data-test-same]').exists();
  });

  test('it tears down the driver when destroyed', async function (assert) {
    const driver = createDriver();
    let tornDown = 0;
    const original = driver.tearDown.bind(driver);
    driver.tearDown = () => {
      tornDown++;
      original();
    };

    await render(<template><SearchProvider @driver={{driver}} /></template>);
    assert.strictEqual(tornDown, 0);
    await clearRender();
    assert.strictEqual(tornDown, 1);
  });

  test('it pushes a changed searchQuery / autocompleteQuery to the driver', async function (assert) {
    const driver = createDriver();
    const calls: [string, unknown][] = [];
    driver.setSearchQuery = (q) => calls.push(['search', q]);
    driver.setAutocompleteQuery = (q) => calls.push(['autocomplete', q]);

    const searchQuery = { result_fields: { title: { raw: {} } } };
    const config = new Box<SearchProviderConfig>({ searchQuery });
    await render(
      <template>
        <SearchProvider @driver={{driver}} @config={{config.value}} as |d|>
          {{if d "ready"}}
        </SearchProvider>
      </template>,
    );
    assert.deepEqual(calls, [], 'initial config is not re-applied');

    config.value = { searchQuery };
    await settled();
    assert.deepEqual(calls, [], 'same searchQuery object is ignored');

    const nextQuery = { result_fields: {} };
    const autocompleteQuery = { results: {} };
    config.value = { searchQuery: nextQuery, autocompleteQuery };
    await settled();
    assert.deepEqual(calls, [
      ['search', nextQuery],
      ['autocomplete', autocompleteQuery],
    ]);
  });

  test('it renders nothing until a driver exists', async function (assert) {
    const driver: SearchDriver = createDriver();
    await render(
      <template>
        <SearchProvider @driver={{driver}}>content</SearchProvider>
      </template>,
    );
    assert.dom().hasText('content');
  });
});
