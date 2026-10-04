import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  fillIn,
  render,
  settled,
  triggerKeyEvent,
  waitFor,
  waitUntil,
} from '@ember/test-helpers';
import { hash } from '@ember/helper';
import { selectChoose } from 'ember-power-select/test-support';
import type { SearchDriver } from '@elastic/search-ui';
import type { SortingOption } from 'ember-search-ui';
import ErrorBoundary from '#src/components/error-boundary.gts';
import Facet from '#src/components/facet.gts';
import Paging from '#src/components/paging.gts';
import PagingInfo from '#src/components/paging-info.gts';
import Results from '#src/components/results.gts';
import ResultsPerPage from '#src/components/results-per-page.gts';
import SearchBox from '#src/components/search-box.gts';
import SingleLinksFacet from '#src/components/single-links-facet.gts';
import Sorting from '#src/components/sorting.gts';
import { createDriver, searchSettled } from '../helpers/search.ts';

// View components wired to a real driver through ember-search-ui's containers.
module('Integration | Views | wired to a driver', function (hooks) {
  setupRenderingTest(hooks);

  let driver: SearchDriver | undefined;

  hooks.afterEach(function () {
    driver?.tearDown();
    driver = undefined;
  });

  test('Results renders a Result per hit', async function (assert) {
    const d = (driver = createDriver());
    await render(
      <template>
        <Results @driver={{d}} @titleField="title" @urlField="nps_link" />
      </template>,
    );
    await searchSettled(d);
    assert.dom('ul.sui-results-container li.sui-result').exists({ count: 5 });
    assert.dom('li.sui-result:nth-child(3) .sui-result__title').hasText('Zion');
    assert
      .dom('li.sui-result:nth-child(5) a')
      .doesNotExist('javascript: urls are not linked');
  });

  test('Results tracks clicks when @shouldTrackClickThrough', async function (assert) {
    const clicks: string[] = [];
    const d = (driver = createDriver({
      onResultClick: (a: { documentId: string }) => clicks.push(a.documentId),
    }));
    await render(
      <template>
        <Results
          @driver={{d}}
          @titleField="title"
          @urlField="nps_link"
          @shouldTrackClickThrough={{true}}
        />
      </template>,
    );
    await searchSettled(d);
    document
      .querySelector('li.sui-result a')!
      .addEventListener('click', (e) => e.preventDefault());
    await click('li.sui-result a');
    assert.deepEqual(clicks, ['1']);
  });

  test('Results forwards @clickThroughTags', async function (assert) {
    const clicks: [string, string[]][] = [];
    const d = (driver = createDriver({
      onResultClick: (a: { documentId: string; tags: string[] }) => {
        clicks.push([a.documentId, a.tags]);
      },
    }));
    const tags = ['promo'];
    await render(
      <template>
        <Results
          @driver={{d}}
          @titleField="title"
          @urlField="nps_link"
          @shouldTrackClickThrough={{true}}
          @clickThroughTags={{tags}}
        />
      </template>,
    );
    await searchSettled(d);
    document
      .querySelector('li.sui-result a')!
      .addEventListener('click', (e) => e.preventDefault());
    await click('li.sui-result a');
    assert.deepEqual(clicks, [['1', ['promo']]]);
  });

  test('Facet defaults to MultiCheckboxFacet and filters results', async function (assert) {
    const d = (driver = createDriver());
    await render(
      <template>
        <Facet
          @driver={{d}}
          @field="states"
          @label="States"
          @filterType="any"
        />
        <Results @driver={{d}} @titleField="title" />
      </template>,
    );
    await searchSettled(d);
    assert.dom('.sui-multi-checkbox-facet__option-label').exists({ count: 5 });

    await click('#example_facet_StatesCalifornia');
    await searchSettled(d, (s) => s.totalResults === 2);
    assert.dom('#example_facet_StatesCalifornia').isChecked();
    assert.dom('li.sui-result').exists({ count: 2 });

    await click('#example_facet_StatesCalifornia');
    await searchSettled(d, (s) => s.totalResults === 5);
    assert.dom('li.sui-result').exists({ count: 5 });
  });

  test('Facet accepts another @view', async function (assert) {
    const d = (driver = createDriver());
    await render(
      <template>
        <Facet
          @driver={{d}}
          @field="states"
          @label="States"
          @view={{SingleLinksFacet}}
        />
      </template>,
    );
    await searchSettled(d);
    assert.dom('.sui-single-option-facet__link').exists({ count: 5 });
  });

  test('Facet accepts the name of a view registered in the app', async function (assert) {
    const d = (driver = createDriver());
    this.owner.register('component:single-links-facet', SingleLinksFacet);
    await render(
      <template>
        <Facet
          @driver={{d}}
          @field="states"
          @label="States"
          @view="single-links-facet"
        />
      </template>,
    );
    await searchSettled(d);
    assert.dom('.sui-single-option-facet__link').exists({ count: 5 });
  });

  test('Facet @isFilterable renders a search input', async function (assert) {
    const d = (driver = createDriver());
    await render(
      <template>
        <Facet
          @driver={{d}}
          @field="states"
          @label="States"
          @isFilterable={{true}}
        />
      </template>,
    );
    await searchSettled(d);
    await fillIn('.sui-facet-search__text-input', 'ut');
    assert.dom('.sui-multi-checkbox-facet__option-label').exists({ count: 1 });
    assert.dom('.sui-multi-checkbox-facet__input-text').hasText('Utah');
  });

  test('Paging renders pages and navigates', async function (assert) {
    const d = (driver = createDriver({ initialState: { resultsPerPage: 2 } }));
    await render(<template><Paging @driver={{d}} /></template>);
    await searchSettled(d);

    assert.dom('.rc-pagination-item').exists({ count: 3 });
    assert.dom('.rc-pagination-item-active').hasText('1');
    assert.dom('.rc-pagination-prev').hasClass('rc-pagination-disabled');

    await click('.rc-pagination-next');
    await searchSettled(d, (s) => s.current === 2);
    assert.dom('.rc-pagination-item-active').hasText('2');

    await click('.rc-pagination-item-2');
    await searchSettled(d, (s) => s.current === 3);
    assert.dom('.rc-pagination-next').hasClass('rc-pagination-disabled');

    await click('.rc-pagination-next');
    assert.strictEqual(
      d.getState().current,
      3,
      'next is a no-op on the last page',
    );

    await click('.rc-pagination-prev');
    await searchSettled(d, (s) => s.current === 2);
    assert.dom('.rc-pagination-item-active').hasText('2');
  });

  test('PagingInfo describes the current page', async function (assert) {
    const d = (driver = createDriver({
      initialState: { resultsPerPage: 2, searchTerm: 'o' },
    }));
    await render(<template><PagingInfo @driver={{d}} /></template>);
    await searchSettled(d);
    assert.dom('.sui-paging-info').hasText('Showing 1 - 2 out of 4 for: o');
  });

  test('ResultsPerPage changes the page size', async function (assert) {
    const d = (driver = createDriver());
    await render(<template><ResultsPerPage @driver={{d}} /></template>);
    await searchSettled(d);
    assert.dom('.sui-results-per-page .sui-select__control').includesText('20');
    await selectChoose('.sui-results-per-page .sui-select', '60');
    await searchSettled(d, (s) => s.resultsPerPage === 60);
    assert.dom('.sui-results-per-page .sui-select__control').includesText('60');
  });

  test('Sorting changes the sort', async function (assert) {
    const d = (driver = createDriver());
    const sortOptions: SortingOption[] = [
      { name: 'Relevance', value: '', direction: '' },
      { name: 'Title Z-A', value: 'title', direction: 'desc' },
    ];
    await render(
      <template>
        <Sorting @driver={{d}} @sortOptions={{sortOptions}} @label="Sort by" />
        <Results @driver={{d}} @titleField="title" />
      </template>,
    );
    await searchSettled(d);
    assert.dom('.sui-sorting__label').hasText('Sort by');
    assert.dom('.sui-sorting .sui-select__control').includesText('Relevance');

    await selectChoose('.sui-sorting .sui-select', 'Title Z-A');
    await searchSettled(d, (s) => s.sortDirection === 'desc');
    assert.dom('.sui-sorting .sui-select__control').includesText('Title Z-A');
    assert.dom('li.sui-result:first-child .sui-result__title').hasText('Zion');
  });

  test('ErrorBoundary shows search errors and still yields', async function (assert) {
    const d = (driver = createDriver({
      onSearch: () => Promise.reject(new Error('nope')),
    }));
    await render(
      <template>
        <ErrorBoundary @driver={{d}} class="err"><p>content</p></ErrorBoundary>
      </template>,
    );
    await waitFor('.sui-search-error');
    assert
      .dom('.sui-search-error.err')
      .hasText('An unexpected error occurred: nope');
    assert.dom('p').hasText('content');
  });

  module('SearchBox', function () {
    test('typing updates the search term and submitting searches', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBox
            @driver={{d}}
            @inputProps={{hash placeholder="Find parks"}}
          />
        </template>,
      );
      await searchSettled(d);

      assert
        .dom('input[type="search"]')
        .hasAttribute('placeholder', 'Find parks');
      await fillIn('input[type="search"]', 'zio');
      assert.strictEqual(d.getState().searchTerm, 'zio');

      await click('input[type="submit"]');
      await searchSettled(d, (s) => s.resultSearchTerm === 'zio');
      assert.strictEqual(d.getState().totalResults, 1);
    });

    test('it shows autocomplete results and suggestions', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBox
            @driver={{d}}
            @autocompleteResults={{hash
              sectionTitle="Parks"
              titleField="title"
              urlField="nps_link"
            }}
            @autocompleteSuggestions={{hash sectionTitle="Suggested"}}
          />
        </template>,
      );
      await searchSettled(d);
      assert.dom('.sui-search-box__autocomplete-container').doesNotExist();

      await fillIn('input[type="search"]', 'y');
      await waitUntil(() => d.getState().autocompletedResults.length === 2, {
        timeout: 2000,
      });
      await settled();

      assert.dom('.sui-search-box').hasClass('autocomplete');
      assert.dom('.sui-search-box__autocomplete-container').exists();
      assert.dom('.sui-search-box__section-title').exists({ count: 2 });
      assert
        .dom('.sui-search-box__suggestion-list [role="menuitem"]')
        .exists({ count: 2 });
      assert
        .dom('.sui-search-box__result-list [role="menuitem"]')
        .exists({ count: 2 });
      assert
        .dom('.sui-search-box__result-list [role="menuitem"]:first-child')
        .hasText('Yosemite');

      await click(
        '.sui-search-box__suggestion-list [role="menuitem"]:nth-child(2)',
      );
      assert.strictEqual(d.getState().searchTerm, 'yellowstone');
      assert
        .dom('.sui-search-box__autocomplete-container')
        .doesNotExist('menu closes after selecting');
      await searchSettled(d, (s) => s.resultSearchTerm === 'yellowstone');
    });

    test('@onSelectAutocomplete handles clicks on autocomplete results', async function (assert) {
      const d = (driver = createDriver());
      const picked: unknown[] = [];
      const onSelectAutocomplete = (selection: Record<string, unknown>) => {
        picked.push((selection['title'] as { raw: string }).raw);
      };
      await render(
        <template>
          <SearchBox
            @driver={{d}}
            @autocompleteResults={{hash titleField="title" urlField="nps_link"}}
            @onSelectAutocomplete={{onSelectAutocomplete}}
          />
        </template>,
      );
      await searchSettled(d);
      await fillIn('input[type="search"]', 'y');
      await waitUntil(() => d.getState().autocompletedResults.length === 2, {
        timeout: 2000,
      });
      await settled();

      await click(
        '.sui-search-box__result-list [role="menuitem"]:nth-child(2)',
      );
      assert.deepEqual(picked, ['Yellowstone']);
      assert
        .dom('.sui-search-box__autocomplete-container')
        .doesNotExist('menu closes after selecting');
    });

    test('arrow keys move through autocomplete items', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBox
            @driver={{d}}
            @autocompleteResults={{hash titleField="title"}}
          />
        </template>,
      );
      await searchSettled(d);
      await fillIn('input[type="search"]', 'y');
      await waitUntil(() => d.getState().autocompletedResults.length === 2, {
        timeout: 2000,
      });
      await settled();

      await triggerKeyEvent('input[type="search"]', 'keydown', 'ArrowDown');

      assert
        .dom('[role="menuitem"]:first-child')
        .hasAttribute('aria-selected', 'true');

      await triggerKeyEvent(
        '.sui-search-box__autocomplete-container',
        'keydown',
        'ArrowDown',
      );
      assert
        .dom('[role="menuitem"]:nth-child(2)')
        .hasAttribute('aria-selected', 'true');
      assert
        .dom('[role="menuitem"]:first-child')
        .hasAttribute('aria-selected', 'false');
    });

    test('Escape clears the input', async function (assert) {
      const d = (driver = createDriver());
      await render(<template><SearchBox @driver={{d}} /></template>);
      await searchSettled(d);
      await fillIn('input[type="search"]', 'zion');
      await triggerKeyEvent('input[type="search"]', 'keydown', 'Escape');
      assert.strictEqual(d.getState().searchTerm, '');
    });
  });
});
