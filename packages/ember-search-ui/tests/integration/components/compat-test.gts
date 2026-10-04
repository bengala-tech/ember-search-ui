import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render } from '@ember/test-helpers';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import {
  SearchDriver,
  memoryBackend,
  searchUiCompat,
  type SearchUiCompat,
} from 'ember-search-ui-driver';
import type { SearchDriver as ElasticSearchDriver } from '@elastic/search-ui';
import WithSearch from '#src/components/with-search.gts';
import PagingContainer from '#src/components/containers/paging.gts';
import PagingInfoContainer from '#src/components/containers/paging-info.gts';
import SortingContainer from '#src/components/containers/sorting.gts';
import SearchBoxContainer from '#src/components/containers/search-box.gts';
import mapContextToProps from '#src/helpers/map-context-to-props.ts';
import type { SortingOption } from '#src/types.ts';

interface Doc {
  id: number;
  title: string;
  state: string;
}

const DOCS: Doc[] = [
  { id: 1, title: 'Yosemite', state: 'open' },
  { id: 2, title: 'Yellowstone', state: 'closed' },
  { id: 3, title: 'Zion', state: 'open' },
  { id: 4, title: 'Joshua Tree', state: 'open' },
  { id: 5, title: 'Acadia', state: 'closed' },
];

// The containers are typed for @elastic/search-ui's driver; the compat object
// provides the same API.
const asSearchUi = (compat: SearchUiCompat<Doc>) =>
  compat as unknown as ElasticSearchDriver;
const titles = (results: unknown) =>
  (results as Doc[]).map((d) => d.title).join(',');

module(
  'Integration | search-ui components on the new driver (compat)',
  function (hooks) {
    setupRenderingTest(hooks);

    let compat: SearchUiCompat<Doc>;
    hooks.beforeEach(function () {
      compat = searchUiCompat(
        new SearchDriver<Doc>({
          backend: memoryBackend(DOCS),
          initialState: { page: { kind: 'offset', page: 1, perPage: 2 } },
        }),
      );
    });
    hooks.afterEach(function () {
      compat.tearDown();
    });

    test('WithSearch, Paging and PagingInfo work unchanged', async function (assert) {
      const driver = asSearchUi(compat);
      await render(
        <template>
          <WithSearch
            @driver={{driver}}
            @mapContextToProps={{mapContextToProps "results" "totalResults"}}
            as |state|
          >
            <span data-test-titles>{{titles state.results}}</span>
            <span data-test-total>{{state.totalResults}}</span>
          </WithSearch>
          <PagingContainer @driver={{driver}} as |paging|>
            <span data-test-page>{{paging.current}}/{{paging.totalPages}}</span>
            <button
              type="button"
              {{on "click" (fn paging.onChange 3)}}
            >3</button>
          </PagingContainer>
          <PagingInfoContainer @driver={{driver}} as |info|>
            <span data-test-info>{{info.start}}-{{info.end}}
              of
              {{info.totalResults}}</span>
          </PagingInfoContainer>
        </template>,
      );
      assert.dom('[data-test-titles]').hasText('Yosemite,Yellowstone');
      assert.dom('[data-test-total]').hasText('5');
      assert.dom('[data-test-page]').hasText('1/3');
      assert.dom('[data-test-info]').hasText('1-2 of 5');

      await click('button');
      assert.dom('[data-test-titles]').hasText('Acadia');
      assert.dom('[data-test-page]').hasText('3/3');
      assert.dom('[data-test-info]').hasText('5-5 of 5');
    });

    test('Sorting and SearchBox containers drive the new driver', async function (assert) {
      const driver = asSearchUi(compat);
      const sortOptions: SortingOption[] = [
        { name: 'Relevance', value: '', direction: '' },
        { name: 'Title', value: 'title', direction: 'asc' },
      ];
      await render(
        <template>
          <SortingContainer
            @driver={{driver}}
            @sortOptions={{sortOptions}}
            as |sorting|
          >
            <button
              type="button"
              data-test-sort
              {{on "click" (fn sorting.onChange "title|||asc")}}
            >sort</button>
          </SortingContainer>
          <SearchBoxContainer @driver={{driver}} as |box|>
            <input
              data-test-search
              value={{box.value}}
              {{on "input" box.onChange}}
            />
          </SearchBoxContainer>
          <WithSearch
            @driver={{driver}}
            @mapContextToProps={{mapContextToProps "results"}}
            as |state|
          >
            <span data-test-titles>{{titles state.results}}</span>
          </WithSearch>
        </template>,
      );
      await click('[data-test-sort]');
      assert.dom('[data-test-titles]').hasText('Acadia,Joshua Tree');

      await fillIn('[data-test-search]', 'yel');
      assert.dom('[data-test-titles]').hasText('Yellowstone');
      assert.strictEqual(compat.driver.state.query.term, 'yel');
    });

    test('field filters set through search-ui actions', async function (assert) {
      const driver = asSearchUi(compat);
      const closedOnly = () =>
        compat.actions.setFilter('state', 'closed', 'any');
      await render(
        <template>
          <button type="button" {{on "click" closedOnly}}>closed</button>
          <WithSearch
            @driver={{driver}}
            @mapContextToProps={{mapContextToProps "results" "filters"}}
            as |state|
          >
            <span data-test-titles>{{titles state.results}}</span>
            <span data-test-filters>{{state.filters.length}}</span>
          </WithSearch>
        </template>,
      );
      await click('button');
      assert.dom('[data-test-titles]').hasText('Yellowstone,Acadia');
      assert.dom('[data-test-filters]').hasText('1');
    });
  },
);
