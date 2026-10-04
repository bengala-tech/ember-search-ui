import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { clearRender, render, settled } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { createDriver, searchSettled } from '../../helpers/search';

module('Integration | Component | with-search', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.driver = createDriver();
  });

  hooks.afterEach(function () {
    this.driver.tearDown();
  });

  test('it yields only the mapped state and actions', async function (assert) {
    await render(hbs`
      <WithSearch
        @driver={{this.driver}}
        @mapContextToProps={{map-context-to-props "totalResults" "setSearchTerm"}}
        as |state|
      >
        <span data-test-total>{{state.totalResults}}</span>
        <span data-test-results>{{state.results.length}}</span>
        <span data-test-action>{{if state.setSearchTerm "has-action"}}</span>
      </WithSearch>
    `);
    await searchSettled(this.driver);

    assert.dom('[data-test-total]').hasText('5');
    assert.dom('[data-test-results]').hasText('', 'unmapped state is not yielded');
    assert.dom('[data-test-action]').hasText('has-action', 'actions can be mapped');
  });

  test('it re-renders when the driver state changes', async function (assert) {
    await render(hbs`
      <WithSearch @driver={{this.driver}} @mapContextToProps={{map-context-to-props "totalResults" "searchTerm"}} as |state|>
        <span data-test-total>{{state.totalResults}}</span>
        <span data-test-term>{{state.searchTerm}}</span>
      </WithSearch>
    `);
    await searchSettled(this.driver);

    this.driver.getActions().setSearchTerm('yel');
    await searchSettled(this.driver, (s) => s.resultSearchTerm === 'yel');

    assert.dom('[data-test-total]').hasText('1');
    assert.dom('[data-test-term]').hasText('yel');
  });

  test('it accepts a custom mapContextToProps function', async function (assert) {
    this.map = (state) => ({ titles: state.results.map((r) => r.title.raw).join(',') });
    await render(hbs`
      <WithSearch @driver={{this.driver}} @mapContextToProps={{this.map}} as |state|>
        <span data-test-titles>{{state.titles}}</span>
      </WithSearch>
    `);
    await searchSettled(this.driver);
    assert.dom('[data-test-titles]').hasText('Yosemite,Yellowstone,Zion,Joshua Tree,Acadia');
  });

  test('it switches subscriptions when the driver changes', async function (assert) {
    let other = createDriver({ onSearch: async () => ({ results: [], totalResults: 42 }) });
    this.set('current', this.driver);
    await render(hbs`
      <WithSearch @driver={{this.current}} @mapContextToProps={{map-context-to-props "totalResults"}} as |state|>
        <span data-test-total>{{state.totalResults}}</span>
      </WithSearch>
    `);
    await searchSettled(this.driver);
    assert.dom('[data-test-total]').hasText('5');
    assert.strictEqual(this.driver.subscriptions.length, 1);

    this.set('current', other);
    await searchSettled(other);
    assert.dom('[data-test-total]').hasText('42');
    assert.strictEqual(this.driver.subscriptions.length, 0, 'unsubscribed from old driver');
    assert.strictEqual(other.subscriptions.length, 1, 'subscribed to new driver');
    other.tearDown();
  });

  test('it unsubscribes when destroyed', async function (assert) {
    await render(hbs`<WithSearch @driver={{this.driver}} @mapContextToProps={{map-context-to-props "totalResults"}} />`);
    assert.strictEqual(this.driver.subscriptions.length, 1);
    await clearRender();
    await settled();
    assert.strictEqual(this.driver.subscriptions.length, 0);
  });
});
