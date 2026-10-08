import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { clearRender, render } from '@ember/test-helpers';
import type { SearchContextState, SearchDriver } from '@elastic/search-ui';
import WithSearch from '#src/components/with-search.gts';
import mapContextToProps from '#src/helpers/map-context-to-props.ts';
import { createDriver, searchSettled } from '../../helpers/search.ts';
import { Box } from '../../helpers/tracked-box.ts';

const isFunction = (value: unknown) => typeof value === 'function';

module('Integration | Component | with-search', function (hooks) {
  setupRenderingTest(hooks);

  let driver: SearchDriver;

  hooks.beforeEach(function () {
    driver = createDriver();
  });

  hooks.afterEach(function () {
    driver.tearDown();
  });

  test('it yields only the mapped state and actions', async function (assert) {
    const d = driver;
    await render(
      <template>
        <WithSearch
          @driver={{d}}
          @mapContextToProps={{mapContextToProps
            "totalResults"
            "setSearchTerm"
          }}
          as |state|
        >
          <span data-test-total>{{state.totalResults}}</span>
          {{! @glint-expect-error -- results is deliberately not mapped }}
          <span data-test-results>{{state.results.length}}</span>
          <span data-test-action>{{if
              (isFunction state.setSearchTerm)
              "has-action"
            }}</span>
        </WithSearch>
      </template>,
    );
    await searchSettled(driver);

    assert.dom('[data-test-total]').hasText('5');
    assert
      .dom('[data-test-results]')
      .hasText('', 'unmapped state is not yielded');
    assert
      .dom('[data-test-action]')
      .hasText('has-action', 'actions can be mapped');
  });

  test('it re-renders when the driver state changes', async function (assert) {
    const d = driver;
    await render(
      <template>
        <WithSearch
          @driver={{d}}
          @mapContextToProps={{mapContextToProps "totalResults" "searchTerm"}}
          as |state|
        >
          <span data-test-total>{{state.totalResults}}</span>
          <span data-test-term>{{state.searchTerm}}</span>
        </WithSearch>
      </template>,
    );
    await searchSettled(driver);

    driver.getActions().setSearchTerm('yel');
    await searchSettled(driver, (s) => s.resultSearchTerm === 'yel');

    assert.dom('[data-test-total]').hasText('1');
    assert.dom('[data-test-term]').hasText('yel');
  });

  test('a change to one mapped key does not re-evaluate the binding for another, unchanged mapped key', async function (assert) {
    const d = driver;
    let resultsPerPageReads = 0;
    const readResultsPerPage = (value: unknown) => {
      resultsPerPageReads++;
      return value;
    };
    await render(
      <template>
        <WithSearch
          @driver={{d}}
          @mapContextToProps={{mapContextToProps
            "totalResults"
            "resultsPerPage"
          }}
          as |state|
        >
          <span data-test-total>{{state.totalResults}}</span>
          <span data-test-per-page>{{readResultsPerPage
              state.resultsPerPage
            }}</span>
        </WithSearch>
      </template>,
    );
    await searchSettled(driver);
    const readsAfterInitialRender = resultsPerPageReads;

    driver.getActions().setSearchTerm('yosemite');
    await searchSettled(driver, (s) => s.resultSearchTerm === 'yosemite');

    assert.dom('[data-test-total]').hasText('1', 'the changed key updated');
    assert.strictEqual(
      resultsPerPageReads,
      readsAfterInitialRender,
      'the unchanged key was not re-evaluated',
    );
  });

  test('it accepts a custom mapContextToProps function', async function (assert) {
    const d = driver;
    const map = (state: SearchContextState) => ({
      titles: state.results
        .map((r) => (r['title'] as { raw: string }).raw)
        .join(','),
    });
    await render(
      <template>
        <WithSearch @driver={{d}} @mapContextToProps={{map}} as |state|>
          <span data-test-titles>{{state.titles}}</span>
        </WithSearch>
      </template>,
    );
    await searchSettled(driver);
    assert
      .dom('[data-test-titles]')
      .hasText('Yosemite,Yellowstone,Zion,Joshua Tree,Acadia');
  });

  test('it switches subscriptions when the driver changes', async function (assert) {
    const other = createDriver({
      apiConnector: {
        onSearch: () =>
          Promise.resolve({ results: [], totalResults: 42 } as never),
        onAutocomplete: () => Promise.resolve({} as never),
        onResultClick() {},
        onAutocompleteResultClick() {},
      },
    });
    const current = new Box(driver);
    await render(
      <template>
        <WithSearch
          @driver={{current.value}}
          @mapContextToProps={{mapContextToProps "totalResults"}}
          as |state|
        >
          <span data-test-total>{{state.totalResults}}</span>
        </WithSearch>
      </template>,
    );
    await searchSettled(driver);
    assert.dom('[data-test-total]').hasText('5');
    assert.strictEqual(driver.subscriptions.length, 1);

    current.value = other;
    await searchSettled(other);
    assert.dom('[data-test-total]').hasText('42');
    assert.strictEqual(
      driver.subscriptions.length,
      0,
      'unsubscribed from old driver',
    );
    assert.strictEqual(
      other.subscriptions.length,
      1,
      'subscribed to new driver',
    );
    other.tearDown();
  });

  test('it unsubscribes when destroyed', async function (assert) {
    const d = driver;
    await render(
      <template>
        <WithSearch
          @driver={{d}}
          @mapContextToProps={{mapContextToProps "totalResults"}}
        />
      </template>,
    );
    assert.strictEqual(driver.subscriptions.length, 1);
    await clearRender();

    assert.strictEqual(driver.subscriptions.length, 0);
  });
});
