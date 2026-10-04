import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { clearRender, find, render, waitUntil } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { buildConfig, createDriver } from '../../helpers/search';

module('Integration | Component | search-provider', function (hooks) {
  setupRenderingTest(hooks);

  test('it creates a driver from @config and yields it', async function (assert) {
    this.config = buildConfig();
    await render(hbs`
      <SearchProvider @config={{this.config}} as |driver|>
        <WithSearch @driver={{driver}} @mapContextToProps={{map-context-to-props "totalResults"}} as |state|>
          <span data-test-total>{{state.totalResults}}</span>
        </WithSearch>
      </SearchProvider>
    `);

    await waitUntil(() => find('[data-test-total]')?.textContent === '5');
    assert.dom('[data-test-total]').hasText('5');
  });

  test('it yields the @driver it was given', async function (assert) {
    this.driver = createDriver();
    await render(hbs`
      <SearchProvider @driver={{this.driver}} as |driver|>
        {{#if (eq driver this.driver)}}<span data-test-same>same</span>{{/if}}
      </SearchProvider>
    `);
    assert.dom('[data-test-same]').exists();
  });

  test('it tears down the driver when destroyed', async function (assert) {
    this.driver = createDriver();
    let tornDown = 0;
    let original = this.driver.tearDown.bind(this.driver);
    this.driver.tearDown = () => {
      tornDown++;
      original();
    };

    await render(hbs`<SearchProvider @driver={{this.driver}} />`);
    assert.strictEqual(tornDown, 0);
    await clearRender();
    assert.strictEqual(tornDown, 1);
  });

  test('it pushes a changed searchQuery / autocompleteQuery to the driver', async function (assert) {
    this.driver = createDriver();
    let calls = [];
    this.driver.setSearchQuery = (q) => calls.push(['search', q]);
    this.driver.setAutocompleteQuery = (q) => calls.push(['autocomplete', q]);

    let searchQuery = { result_fields: { title: { raw: {} } } };
    this.set('config', { searchQuery });
    await render(hbs`<SearchProvider @driver={{this.driver}} @config={{this.config}} as |driver|>{{if driver "ready"}}</SearchProvider>`);
    assert.deepEqual(calls, [], 'initial config is not re-applied');

    this.set('config', { searchQuery });
    assert.deepEqual(calls, [], 'same searchQuery object is ignored');

    let nextQuery = { result_fields: {} };
    let autocompleteQuery = { results: {} };
    this.set('config', { searchQuery: nextQuery, autocompleteQuery });
    assert.deepEqual(calls, [
      ['search', nextQuery],
      ['autocomplete', autocompleteQuery],
    ]);
  });

  test('it renders nothing until a driver exists', async function (assert) {
    this.driver = createDriver();
    await render(hbs`<SearchProvider @driver={{this.driver}}>content</SearchProvider>`);
    assert.dom(this.element).hasText('content');
  });
});
