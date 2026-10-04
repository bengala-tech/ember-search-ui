import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, settled, triggerKeyEvent, waitFor, waitUntil } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { selectChoose } from 'ember-power-select/test-support';
import { createDriver, searchSettled } from '../../helpers/search';

// View components from ember-search-ui-views wired to a real driver.
module('Integration | Views | wired to a driver', function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(function () {
    this.driver?.tearDown();
  });

  test('Results renders a Result per hit', async function (assert) {
    this.driver = createDriver();
    await render(hbs`<Results @driver={{this.driver}} @titleField="title" @urlField="nps_link" />`);
    await searchSettled(this.driver);
    assert.dom('ul.sui-results-container li.sui-result').exists({ count: 5 });
    assert.dom('li.sui-result:nth-child(3) .sui-result__title').hasText('Zion');
    assert.dom('li.sui-result:nth-child(5) a').doesNotExist('javascript: urls are not linked');
  });

  test('Results tracks clicks when @shouldTrackClickThrough', async function (assert) {
    let clicks = [];
    this.driver = createDriver({ onResultClick: (a) => clicks.push(a.documentId) });
    await render(hbs`<Results @driver={{this.driver}} @titleField="title" @urlField="nps_link" @shouldTrackClickThrough={{true}} />`);
    await searchSettled(this.driver);
    document.querySelector('li.sui-result a').addEventListener('click', (e) => e.preventDefault());
    await click('li.sui-result a');
    assert.deepEqual(clicks, ['1']);
  });

  test('Facet defaults to MultiCheckboxFacet and filters results', async function (assert) {
    this.driver = createDriver();
    await render(hbs`
      <Facet @driver={{this.driver}} @field="states" @label="States" @filterType="any" />
      <Results @driver={{this.driver}} @titleField="title" />
    `);
    await searchSettled(this.driver);
    assert.dom('.sui-multi-checkbox-facet__option-label').exists({ count: 5 });

    await click('#example_facet_StatesCalifornia');
    await searchSettled(this.driver, (s) => s.totalResults === 2);
    assert.dom('#example_facet_StatesCalifornia').isChecked();
    assert.dom('li.sui-result').exists({ count: 2 });

    await click('#example_facet_StatesCalifornia');
    await searchSettled(this.driver, (s) => s.totalResults === 5);
    assert.dom('li.sui-result').exists({ count: 5 });
  });

  test('Facet accepts another @view', async function (assert) {
    this.driver = createDriver();
    await render(hbs`<Facet @driver={{this.driver}} @field="states" @label="States" @view="single-links-facet" />`);
    await searchSettled(this.driver);
    assert.dom('.sui-single-option-facet__link').exists({ count: 5 });
  });

  test('Facet @isFilterable renders a search input', async function (assert) {
    this.driver = createDriver();
    await render(hbs`<Facet @driver={{this.driver}} @field="states" @label="States" @isFilterable={{true}} />`);
    await searchSettled(this.driver);
    await fillIn('.sui-facet-search__text-input', 'ut');
    assert.dom('.sui-multi-checkbox-facet__option-label').exists({ count: 1 });
    assert.dom('.sui-multi-checkbox-facet__input-text').hasText('Utah');
  });

  test('Paging renders pages and navigates', async function (assert) {
    this.driver = createDriver({ initialState: { resultsPerPage: 2 } });
    await render(hbs`<Paging @driver={{this.driver}} />`);
    await searchSettled(this.driver);

    assert.dom('.rc-pagination-item').exists({ count: 3 });
    assert.dom('.rc-pagination-item-active').hasText('1');
    assert.dom('.rc-pagination-prev').hasClass('rc-pagination-disabled');

    await click('.rc-pagination-next');
    await searchSettled(this.driver, (s) => s.current === 2);
    assert.dom('.rc-pagination-item-active').hasText('2');

    await click('.rc-pagination-item-2');
    await searchSettled(this.driver, (s) => s.current === 3);
    assert.dom('.rc-pagination-next').hasClass('rc-pagination-disabled');

    await click('.rc-pagination-next');
    assert.strictEqual(this.driver.getState().current, 3, 'next is a no-op on the last page');

    await click('.rc-pagination-prev');
    await searchSettled(this.driver, (s) => s.current === 2);
    assert.dom('.rc-pagination-item-active').hasText('2');
  });

  test('PagingInfo describes the current page', async function (assert) {
    this.driver = createDriver({ initialState: { resultsPerPage: 2, searchTerm: 'o' } });
    await render(hbs`<PagingInfo @driver={{this.driver}} />`);
    await searchSettled(this.driver);
    assert.dom('.sui-paging-info').hasText('Showing 1 - 2 out of 4 for: o');
  });

  test('ResultsPerPage changes the page size', async function (assert) {
    this.driver = createDriver();
    await render(hbs`<ResultsPerPage @driver={{this.driver}} />`);
    await searchSettled(this.driver);
    assert.dom('.sui-results-per-page .sui-select__control').includesText('20');
    await selectChoose('.sui-results-per-page .sui-select', '60');
    await searchSettled(this.driver, (s) => s.resultsPerPage === 60);
    assert.dom('.sui-results-per-page .sui-select__control').includesText('60');
  });

  test('Sorting changes the sort', async function (assert) {
    this.driver = createDriver();
    this.sortOptions = [
      { name: 'Relevance', value: '', direction: '' },
      { name: 'Title Z-A', value: 'title', direction: 'desc' },
    ];
    await render(hbs`
      <Sorting @driver={{this.driver}} @sortOptions={{this.sortOptions}} @label="Sort by" />
      <Results @driver={{this.driver}} @titleField="title" />
    `);
    await searchSettled(this.driver);
    assert.dom('.sui-sorting__label').hasText('Sort by');
    assert.dom('.sui-sorting .sui-select__control').includesText('Relevance');

    await selectChoose('.sui-sorting .sui-select', 'Title Z-A');
    await searchSettled(this.driver, (s) => s.sortDirection === 'desc');
    assert.dom('.sui-sorting .sui-select__control').includesText('Title Z-A');
    assert.dom('li.sui-result:first-child .sui-result__title').hasText('Zion');
  });

  test('ErrorBoundary shows search errors and still yields', async function (assert) {
    this.driver = createDriver({
      onSearch: async () => {
        throw new Error('nope');
      },
    });
    await render(hbs`<ErrorBoundary @driver={{this.driver}} class="err"><p>content</p></ErrorBoundary>`);
    await waitFor('.sui-search-error');
    assert.dom('.sui-search-error.err').hasText('An unexpected error occurred: nope');
    assert.dom('p').hasText('content');
  });

  module('SearchBox', function () {
    test('typing updates the search term and submitting searches', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<SearchBox @driver={{this.driver}} @inputProps={{hash placeholder="Find parks"}} />`);
      await searchSettled(this.driver);

      assert.dom('input[type="search"]').hasAttribute('placeholder', 'Find parks');
      await fillIn('input[type="search"]', 'zio');
      assert.strictEqual(this.driver.getState().searchTerm, 'zio');

      await click('input[type="submit"]');
      await searchSettled(this.driver, (s) => s.resultSearchTerm === 'zio');
      assert.strictEqual(this.driver.getState().totalResults, 1);
    });

    test('it shows autocomplete results and suggestions', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <SearchBox
          @driver={{this.driver}}
          @autocompleteResults={{hash sectionTitle="Parks" titleField="title" urlField="nps_link"}}
          @autocompleteSuggestions={{hash sectionTitle="Suggested"}}
        />
      `);
      await searchSettled(this.driver);
      assert.dom('.sui-search-box__autocomplete-container').doesNotExist();

      await fillIn('input[type="search"]', 'y');
      await waitUntil(() => this.driver.getState().autocompletedResults.length === 2, { timeout: 2000 });
      await settled();

      assert.dom('.sui-search-box').hasClass('autocomplete');
      assert.dom('.sui-search-box__autocomplete-container').exists();
      assert.dom('.sui-search-box__section-title').exists({ count: 2 });
      assert.dom('.sui-search-box__suggestion-list [role="menuitem"]').exists({ count: 2 });
      assert.dom('.sui-search-box__result-list [role="menuitem"]').exists({ count: 2 });
      assert.dom('.sui-search-box__result-list [role="menuitem"]:first-child').hasText('Yosemite');

      await click('.sui-search-box__suggestion-list [role="menuitem"]:nth-child(2)');
      assert.strictEqual(this.driver.getState().searchTerm, 'yellowstone');
      assert.dom('.sui-search-box__autocomplete-container').doesNotExist('menu closes after selecting');
      await searchSettled(this.driver, (s) => s.resultSearchTerm === 'yellowstone');
    });

    test('arrow keys move through autocomplete items', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<SearchBox @driver={{this.driver}} @autocompleteResults={{hash titleField="title"}} />`);
      await searchSettled(this.driver);
      await fillIn('input[type="search"]', 'y');
      await waitUntil(() => this.driver.getState().autocompletedResults.length === 2, { timeout: 2000 });
      await settled();

      await triggerKeyEvent('input[type="search"]', 'keydown', 'ArrowDown');
      await settled();
      assert.dom('[role="menuitem"]:first-child').hasAttribute('aria-selected', 'true');

      await triggerKeyEvent('.sui-search-box__autocomplete-container', 'keydown', 'ArrowDown');
      assert.dom('[role="menuitem"]:nth-child(2)').hasAttribute('aria-selected', 'true');
      assert.dom('[role="menuitem"]:first-child').hasAttribute('aria-selected', 'false');
    });

    test('Escape clears the input', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<SearchBox @driver={{this.driver}} />`);
      await searchSettled(this.driver);
      await fillIn('input[type="search"]', 'zion');
      await triggerKeyEvent('input[type="search"]', 'keydown', 'Escape');
      assert.strictEqual(this.driver.getState().searchTerm, '');
    });
  });
});
