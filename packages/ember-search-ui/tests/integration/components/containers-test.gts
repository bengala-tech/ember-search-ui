import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  fillIn,
  render,
  settled,
  triggerEvent,
  waitUntil,
} from '@ember/test-helpers';
import { array, fn, hash } from '@ember/helper';
import { on } from '@ember/modifier';
import type { TOC } from '@ember/component/template-only';
import type { SearchDriver, SearchResult } from '@elastic/search-ui';
import ErrorBoundaryContainer from '#src/components/containers/error-boundary.gts';
import FacetContainer, {
  type FacetViewSignature,
} from '#src/components/containers/facet.gts';
import PagingContainer, {
  type PagingViewSignature,
} from '#src/components/containers/paging.gts';
import PagingInfoContainer from '#src/components/containers/paging-info.gts';
import ResultContainer, {
  type ResultViewSignature,
} from '#src/components/containers/result.gts';
import ResultsContainer, {
  type ResultsViewSignature,
} from '#src/components/containers/results.gts';
import ResultsPerPageContainer from '#src/components/containers/results-per-page.gts';
import SearchBoxContainer, {
  type AutocompleteSelection,
  type OnSelectAutocompleteHelpers,
} from '#src/components/containers/search-box.gts';
import SortingContainer from '#src/components/containers/sorting.gts';
import type { SortingOption } from '#src/types.ts';
import { createDriver, searchSettled } from '../../helpers/search.ts';
import { Box } from '../../helpers/tracked-box.ts';

const join = (separator: string, values: unknown[] | undefined) =>
  (values ?? []).join(separator);
const rawOf = (result: SearchResult, field: string | undefined) =>
  String((result[field!] as { raw?: string } | undefined)?.raw ?? '');
const display = (value: unknown) => String(value);
const optional = (action: (() => void) | undefined) => () => action?.();

module('Integration | Component | containers', function (hooks) {
  setupRenderingTest(hooks);

  let driver: SearchDriver | undefined;

  hooks.afterEach(function () {
    driver?.tearDown();
    driver = undefined;
  });

  module('Paging', function () {
    test('it yields paging state and changes page', async function (assert) {
      const d = (driver = createDriver({
        initialState: { resultsPerPage: 2 },
      }));
      await render(
        <template>
          <PagingContainer @driver={{d}} as |paging|>
            <span data-test-current>{{paging.current}}</span>
            <span data-test-total-pages>{{paging.totalPages}}</span>
            <span data-test-per-page>{{paging.resultsPerPage}}</span>
            <button
              type="button"
              {{on "click" (fn paging.onChange 3)}}
            >go</button>
          </PagingContainer>
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-current]').hasText('1');
      assert.dom('[data-test-total-pages]').hasText('3');
      assert.dom('[data-test-per-page]').hasText('2');

      await click('button');
      await searchSettled(d, (s) => s.current === 3);
      assert.dom('[data-test-current]').hasText('3');
    });

    test('it renders a custom @view with the paging args', async function (assert) {
      const d = (driver = createDriver({
        initialState: { resultsPerPage: 2 },
      }));
      const View: TOC<PagingViewSignature> = <template>
        <div data-test-view class="custom" ...attributes>
          {{@current}}/{{@totalPages}}/{{@resultsPerPage}}
        </div>
      </template>;
      await render(
        <template>
          <PagingContainer @driver={{d}} @view={{View}} data-test-attr="x" />
        </template>,
      );
      await searchSettled(d);
      assert
        .dom('[data-test-view]')
        .hasText('1/3/2')
        .hasAttribute('data-test-attr', 'x');
    });

    test('@view may be the name of a component registered in the app', async function (assert) {
      const d = (driver = createDriver({
        initialState: { resultsPerPage: 2 },
      }));
      const View: TOC<PagingViewSignature> = <template>
        <div data-test-view>{{@current}}/{{@totalPages}}</div>
      </template>;
      this.owner.register('component:my-paging', View);
      await render(
        <template>
          <PagingContainer @driver={{d}} @view="my-paging" />
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-view]').hasText('1/3');
    });
  });

  module('PagingInfo', function () {
    test('it yields start, end, total and searchTerm', async function (assert) {
      const d = (driver = createDriver({
        initialState: { resultsPerPage: 2, current: 2, searchTerm: 'o' },
      }));
      await render(
        <template>
          <PagingInfoContainer @driver={{d}} as |info|>
            {{info.start}}-{{info.end}}
            of
            {{info.totalResults}}
            for
            {{info.searchTerm}}
          </PagingInfoContainer>
        </template>,
      );
      await searchSettled(d);
      // "o" matches Yosemite, Yellowstone, Zion, Joshua Tree
      assert.dom().hasText('3-4 of 4 for o');
    });
  });

  module('ResultsPerPage', function () {
    test('it yields default options and changes page size', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <ResultsPerPageContainer @driver={{d}} as |rpp|>
            <span data-test-options>{{join "," rpp.options}}</span>
            <span data-test-value>{{rpp.value}}</span>
            <button
              type="button"
              {{on "click" (fn rpp.onChange 40)}}
            >40</button>
          </ResultsPerPageContainer>
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-options]').hasText('20,40,60');
      assert.dom('[data-test-value]').hasText('20');

      await click('button');
      await searchSettled(d, (s) => s.resultsPerPage === 40);
      assert.dom('[data-test-value]').hasText('40');
    });

    test('it accepts custom @options', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <ResultsPerPageContainer
            @driver={{d}}
            @options={{array 5 10}}
            as |rpp|
          >
            {{join "," rpp.options}}
          </ResultsPerPageContainer>
        </template>,
      );
      assert.dom().hasText('5,10');
    });
  });

  module('Sorting', function () {
    const sortOptions: SortingOption[] = [
      { name: 'Relevance', value: '', direction: '' },
      { name: 'Title A-Z', value: 'title', direction: 'asc' },
      { name: 'Title Z-A', value: 'title', direction: 'desc' },
    ];

    test('it yields formatted options and the current value', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SortingContainer
            @driver={{d}}
            @sortOptions={{sortOptions}}
            @label="Sort by"
            as |sorting|
          >
            <span data-test-label>{{sorting.label}}</span>
            <span data-test-value>{{sorting.value}}</span>
            {{#each sorting.options as |option|}}
              <span data-test-option={{option.value}}>{{option.label}}</span>
            {{/each}}
          </SortingContainer>
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-label]').hasText('Sort by');
      assert.dom('[data-test-value]').hasText('|||');
      assert.dom('[data-test-option]').exists({ count: 3 });
      assert.dom('[data-test-option="title|||desc"]').hasText('Title Z-A');
    });

    test('onChange accepts a formatted string or an option object', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SortingContainer
            @driver={{d}}
            @sortOptions={{sortOptions}}
            as |sorting|
          >
            <span data-test-value>{{sorting.value}}</span>
            <span data-test-field>{{sorting.sortField}}</span>
            <span data-test-direction>{{sorting.sortDirection}}</span>
            <button
              type="button"
              data-test-string
              {{on "click" (fn sorting.onChange "title|||desc")}}
            >desc</button>
            <button
              type="button"
              data-test-object
              {{on "click" (fn sorting.onChange (hash value="title|||asc"))}}
            >asc</button>
          </SortingContainer>
        </template>,
      );
      await searchSettled(d);

      await click('[data-test-string]');
      await searchSettled(d, (s) => s.sortDirection === 'desc');
      assert.dom('[data-test-value]').hasText('title|||desc');
      assert.dom('[data-test-field]').hasText('title');
      assert.dom('[data-test-direction]').hasText('desc');

      await click('[data-test-object]');
      await searchSettled(d, (s) => s.sortDirection === 'asc');
      assert.dom('[data-test-value]').hasText('title|||asc');
    });
  });

  module('Facet', function () {
    const View: TOC<FacetViewSignature> = <template>
      <div data-test-facet ...attributes>
        <span data-test-label>{{@label}}</span>
        <span data-test-values>{{join "," @values}}</span>
        <span data-test-placeholder>{{@searchPlaceholder}}</span>
        {{#if @showSearch}}<input
            data-test-search
            {{on "input" @onSearch}}
          />{{/if}}
        {{#each @options as |option|}}
          <button
            type="button"
            data-test-option="{{display option.value}}"
            data-test-selected={{if option.selected "true" "false"}}
            {{on
              "click"
              (if
                option.selected
                (fn @onRemove option.value)
                (fn @onSelect option.value)
              )
            }}
          >{{display option.value}} ({{option.count}})</button>
        {{/each}}
        <button
          type="button"
          data-test-set
          {{on "click" (fn @onChange "Utah")}}
        >set</button>
        {{#if @showMore}}<button
            type="button"
            data-test-more
            {{on "click" @onMoreClick}}
          >more</button>{{/if}}
      </div>
    </template>;

    test('it renders the facet values for @field via @view', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer
            @driver={{d}}
            @field="states"
            @label="States"
            @view={{View}}
          />
        </template>,
      );
      await searchSettled(d);

      assert.dom('[data-test-label]').hasText('States');
      assert.dom('[data-test-option]').exists({ count: 5 });
      assert.dom('[data-test-option="California"]').hasText('California (2)');
      assert.dom('[data-test-placeholder]').hasText('Field states');
      assert.dom('[data-test-search]').doesNotExist();
    });

    test('it renders nothing when the field has no facet', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer @driver={{d}} @field="nope" @view={{View}} />
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-facet]').doesNotExist();
    });

    test('onSelect / onRemove add and remove filters using @filterType', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer
            @driver={{d}}
            @field="states"
            @filterType="any"
            @view={{View}}
          />
        </template>,
      );
      await searchSettled(d);

      await click('[data-test-option="California"]');
      await searchSettled(d, (s) => s.filters?.length === 1);
      assert.deepEqual(
        d
          .getState()
          .filters?.map(({ field, values, type }) => ({ field, values, type })),
        [{ field: 'states', values: ['California'], type: 'any' }],
      );
      assert
        .dom('[data-test-option="California"]')
        .hasAttribute('data-test-selected', 'true');
      assert.dom('[data-test-values]').hasText('California');

      await click('[data-test-option="Utah"]');
      await searchSettled(d, (s) => s.filters?.[0]?.values.length === 2);
      assert.dom('[data-test-values]').hasText('California,Utah');

      await click('[data-test-option="California"]');
      await searchSettled(d, (s) => s.filters?.[0]?.values.length === 1);
      assert.dom('[data-test-values]').hasText('Utah');
    });

    test('@filterType defaults to "all"', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer @driver={{d}} @field="states" @view={{View}} />
        </template>,
      );
      await searchSettled(d);
      await click('[data-test-option="Maine"]');
      await searchSettled(d, (s) => s.filters?.length === 1);
      assert.strictEqual(d.getState().filters?.[0]?.type, 'all');
    });

    test('onChange replaces the filter value', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer
            @driver={{d}}
            @field="states"
            @filterType="any"
            @view={{View}}
          />
        </template>,
      );
      await searchSettled(d);
      await click('[data-test-option="California"]');
      await searchSettled(d, (s) => s.filters?.length === 1);
      await click('[data-test-set]');
      await searchSettled(d, (s) => s.filters?.[0]?.values[0] === 'Utah');
      assert.dom('[data-test-values]').hasText('Utah');
    });

    test('it shows @show options and reveals 10 more on demand', async function (assert) {
      const d = (driver = createDriver());
      const notifications: unknown[] = [];
      const a11yNotify = d.getActions().a11yNotify;
      d.actions.a11yNotify = (name, args) => {
        notifications.push([name, args]);
        return a11yNotify(name, args);
      };

      await render(
        <template>
          <FacetContainer
            @driver={{d}}
            @field="states"
            @show={{2}}
            @view={{View}}
          />
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-option]').exists({ count: 2 });

      await click('[data-test-more]');
      assert.dom('[data-test-option]').exists({ count: 5 });
      assert.deepEqual(notifications, [
        ['moreFilters', { visibleOptionsCount: 5, showingAll: true }],
      ]);
    });

    test('in block form it yields the visible, filtered options', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer @driver={{d}} @field="states" @show={{2}} as |facet|>
            <input data-test-search {{on "input" facet.onSearch}} />
            {{#each facet.options as |option|}}
              <span data-test-option>{{display option.value}}</span>
            {{/each}}
          </FacetContainer>
        </template>,
      );
      await searchSettled(d);
      assert.deepEqual(
        [...document.querySelectorAll('[data-test-option]')].map(
          (e) => e.textContent,
        ),
        ['California', 'Wyoming'],
      );

      await fillIn('[data-test-search]', 'ut');
      assert.deepEqual(
        [...document.querySelectorAll('[data-test-option]')].map(
          (e) => e.textContent,
        ),
        ['Utah'],
      );
    });

    test('@isFilterable enables accent-insensitive searching of options', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <FacetContainer
            @driver={{d}}
            @field="states"
            @isFilterable={{true}}
            @view={{View}}
          />
        </template>,
      );
      await searchSettled(d);

      await fillIn('[data-test-search]', 'MÁ');
      assert.dom('[data-test-option]').exists({ count: 1 });
      assert.dom('[data-test-option="Maine"]').exists();

      await fillIn('[data-test-search]', '  ');
      assert
        .dom('[data-test-option]')
        .exists({ count: 5 }, 'whitespace does not filter');
    });
  });

  module('SearchBox', function () {
    test('onChange accepts strings and input events', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBoxContainer @driver={{d}} as |box|>
            <input
              data-test-input
              value={{box.value}}
              {{on "input" box.onChange}}
            />
            <button
              type="button"
              {{on "click" (fn box.onChange "zion")}}
            >zion</button>
          </SearchBoxContainer>
        </template>,
      );
      await searchSettled(d);

      await fillIn('[data-test-input]', 'yo');
      assert.strictEqual(d.getState().searchTerm, 'yo');
      assert.dom('[data-test-input]').hasValue('yo');

      await click('button');
      assert.strictEqual(d.getState().searchTerm, 'zion');
    });

    test('onChange forwards search options to setSearchTerm', async function (assert) {
      const d = (driver = createDriver());
      const calls: unknown[] = [];
      const original = d.actions.setSearchTerm;
      d.actions.setSearchTerm = (term, options) => {
        calls.push([term, options]);
        return original(term, options);
      };

      const searchAsYouType = new Box(false);
      const shouldClearFilters = new Box<boolean | undefined>(undefined);
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @searchAsYouType={{searchAsYouType.value}}
            @shouldClearFilters={{shouldClearFilters.value}}
            @debounceLength={{50}}
            @autocompleteMinimumCharacters={{2}}
            as |box|
          >
            <button
              type="button"
              {{on "click" (fn box.onChange "a")}}
            >a</button>
          </SearchBoxContainer>
        </template>,
      );

      await click('button');
      assert.deepEqual(calls.pop(), [
        'a',
        {
          autocompleteMinimumCharacters: 2,
          shouldClearFilters: true,
          refresh: false,
          autocompleteResults: false,
          autocompleteSuggestions: false,
        },
      ]);

      searchAsYouType.value = true;
      shouldClearFilters.value = false;
      await settled();
      await click('button');
      assert.deepEqual(calls.pop(), [
        'a',
        {
          autocompleteMinimumCharacters: 2,
          debounce: 50,
          shouldClearFilters: false,
          refresh: true,
          autocompleteResults: false,
          autocompleteSuggestions: false,
        },
      ]);
      await searchSettled(d, (s) => s.resultSearchTerm === 'a');
    });

    test('onSubmit prevents the default, calls @onSubmit and searches', async function (assert) {
      const d = (driver = createDriver({ initialState: { searchTerm: 'zi' } }));
      const onSubmit = (_setSearchTerm: unknown, term: string) =>
        assert.step(`onSubmit:${term}`);
      await render(
        <template>
          <SearchBoxContainer @driver={{d}} @onSubmit={{onSubmit}} as |box|>
            <form {{on "submit" box.onSubmit}}><button
                type="submit"
              >go</button></form>
          </SearchBoxContainer>
        </template>,
      );
      await searchSettled(d);
      await click('button');
      await searchSettled(d);
      assert.verifySteps(['onSubmit:zi']);
      assert.strictEqual(d.getState().resultSearchTerm, 'zi');
    });

    test('useAutocomplete respects autocomplete flags and minimum characters', async function (assert) {
      const d = (driver = createDriver({ initialState: { searchTerm: 'y' } }));
      const min = new Box(2);
      const results = new Box<{ titleField: string } | undefined>({
        titleField: 'title',
      });
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @autocompleteResults={{results.value}}
            @autocompleteMinimumCharacters={{min.value}}
            as |box|
          >
            <span data-test-use>{{if box.useAutocomplete "yes" "no"}}</span>
          </SearchBoxContainer>
        </template>,
      );
      assert.dom('[data-test-use]').hasText('no');
      min.value = 1;
      await settled();
      assert.dom('[data-test-use]').hasText('yes');
      results.value = undefined;
      await settled();
      assert.dom('[data-test-use]').hasText('no');
    });

    test('it yields autocomplete counts', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @autocompleteResults={{true}}
            @autocompleteSuggestions={{true}}
            as |box|
          >
            <span data-test-all>{{box.allAutocompletedItemsCount}}</span>
            <span
              data-test-suggestions
            >{{box.autocompletedSuggestionsCount}}</span>
            <button
              type="button"
              {{on "click" (fn box.onChange "y")}}
            >y</button>
          </SearchBoxContainer>
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-all]').hasText('0');

      await click('button');
      await searchSettled(d, (s) => s.autocompletedResults.length === 2);
      assert.dom('[data-test-all]').hasText('4');
      assert.dom('[data-test-suggestions]').hasText('2');
    });

    test('selecting an autocomplete suggestion completes the search term', async function (assert) {
      const d = (driver = createDriver());
      const selection: AutocompleteSelection = { suggestion: 'zion' };
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @autocompleteResults={{hash urlField="nps_link"}}
            as |box|
          >
            <button
              type="button"
              {{on "click" (fn box.onSelectAutocomplete selection)}}
            >pick</button>
          </SearchBoxContainer>
        </template>,
      );
      await click('button');
      assert.strictEqual(d.getState().searchTerm, 'zion');
      await searchSettled(d, (s) => s.resultSearchTerm === 'zion');
    });

    test('@onSelectAutocomplete gets the selection, helpers and the default handler', async function (assert) {
      const d = (driver = createDriver());
      const seen: unknown[] = [];
      const onSelectAutocomplete = (
        selection: AutocompleteSelection,
        helpers: OnSelectAutocompleteHelpers,
        defaultOnSelectAutocomplete: (selection: AutocompleteSelection) => void,
      ) => {
        seen.push([
          selection,
          typeof helpers.setSearchTerm,
          helpers.autocompleteResults,
          helpers.autocompleteSuggestions,
        ]);
        defaultOnSelectAutocomplete(selection);
      };
      const selection: AutocompleteSelection = { suggestion: 'zion' };
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @autocompleteSuggestions={{true}}
            @onSelectAutocomplete={{onSelectAutocomplete}}
            as |box|
          >
            <button
              type="button"
              {{on "click" (fn box.onSelectAutocomplete selection)}}
            >pick</button>
          </SearchBoxContainer>
        </template>,
      );
      await click('button');
      assert.deepEqual(seen, [
        [{ suggestion: 'zion' }, 'function', undefined, true],
      ]);
      assert.strictEqual(
        d.getState().searchTerm,
        'zion',
        'default handler ran',
      );
      await searchSettled(d, (s) => s.resultSearchTerm === 'zion');
    });

    test('@handleOnSelectAutocomplete (deprecated) replaces the default handler', async function (assert) {
      const d = (driver = createDriver());
      const handle = (selection: AutocompleteSelection) =>
        assert.step(`handle:${selection.suggestion}`);
      const selection: AutocompleteSelection = { suggestion: 'zion' };
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @handleOnSelectAutocomplete={{handle}}
            as |box|
          >
            <button
              type="button"
              {{on "click" (fn box.onSelectAutocomplete selection)}}
            >pick</button>
          </SearchBoxContainer>
        </template>,
      );
      await click('button');
      assert.verifySteps(['handle:zion']);
      assert.strictEqual(
        d.getState().searchTerm,
        '',
        'default handler did not run',
      );
    });

    test('selecting an autocomplete result opens its url and tracks the click', async function (assert) {
      const clicks: { documentId: string; tags: string[] }[] = [];
      const d = (driver = createDriver({
        onAutocompleteResultClick: (args: (typeof clicks)[number]) => {
          clicks.push(args);
        },
      }));
      // eslint-disable-next-line @typescript-eslint/unbound-method -- restored as-is below
      const originalOpen = window.open;
      window.open = (url, target) => {
        assert.step(`open:${String(url)}:${target}`);
        return null;
      };
      const selection: AutocompleteSelection = {
        id: { raw: '3' },
        nps_link: { raw: 'https://www.nps.gov/zion' },
      };

      try {
        await render(
          <template>
            <SearchBoxContainer
              @driver={{d}}
              @autocompleteResults={{hash
                urlField="nps_link"
                linkTarget="_blank"
                clickThroughTags=(array "ac")
              }}
              as |box|
            >
              <button
                type="button"
                {{on "click" (fn box.onSelectAutocomplete selection)}}
              >pick</button>
            </SearchBoxContainer>
          </template>,
        );
        await click('button');
      } finally {
        window.open = originalOpen;
      }

      assert.verifySteps(['open:https://www.nps.gov/zion:_blank']);
      assert.strictEqual(clicks.length, 1);
      assert.strictEqual(clicks[0]?.documentId, '3');
      assert.deepEqual(clicks[0]?.tags, ['ac']);
    });

    test('inputProps tracks focus and merges @inputProps', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <SearchBoxContainer
            @driver={{d}}
            @inputProps={{hash placeholder="Find a park"}}
            as |box|
          >
            <input
              placeholder={{box.inputProps.placeholder}}
              {{on "focus" box.inputProps.onFocus}}
              {{on "blur" box.inputProps.onBlur}}
            />
            <span data-test-focused>{{if
                box.isFocused
                "focused"
                "blurred"
              }}</span>
          </SearchBoxContainer>
        </template>,
      );
      assert.dom('input').hasAttribute('placeholder', 'Find a park');
      assert.dom('[data-test-focused]').hasText('blurred');
      await triggerEvent('input', 'focus');
      assert.dom('[data-test-focused]').hasText('focused');
      await triggerEvent('input', 'blur');
      assert.dom('[data-test-focused]').hasText('blurred');
    });
  });

  module('ErrorBoundary', function () {
    test('it yields the driver error', async function (assert) {
      const d = (driver = createDriver({
        onSearch: () => Promise.reject(new Error('boom')),
      }));
      await render(
        <template>
          <ErrorBoundaryContainer @driver={{d}} as |state|>
            <span data-test-error>{{state.error}}</span>
          </ErrorBoundaryContainer>
        </template>,
      );
      // search-ui leaves isLoading=true on errors, so wait for the error itself
      await waitUntil(() => d.getState().error);
      await settled();
      assert
        .dom('[data-test-error]')
        .hasText('An unexpected error occurred: boom');
    });
  });

  module('Results / Result', function () {
    const ResultView: TOC<ResultViewSignature> = <template>
      <li
        data-test-result="{{rawOf @result 'id'}}"
        data-test-title-field={{@titleField}}
        data-test-url-field={{@urlField}}
      >
        {{#if @onClickLink}}
          <button type="button" {{on "click" @onClickLink}}>{{rawOf
              @result
              @titleField
            }}</button>
        {{else}}
          {{rawOf @result @titleField}}
        {{/if}}
      </li>
    </template>;
    const ListView: TOC<ResultsViewSignature> = <template>
      <ul data-test-list ...attributes>{{yield}}</ul>
    </template>;

    test('it renders each result with @resultView', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <ResultsContainer
            @driver={{d}}
            @resultView={{ResultView}}
            @titleField="title"
            @urlField="nps_link"
          />
        </template>,
      );
      await searchSettled(d);
      assert.dom('[data-test-result]').exists({ count: 5 });
      assert.dom('[data-test-result="3"]').hasText('Zion');
      assert
        .dom('[data-test-result="3"]')
        .hasAttribute('data-test-title-field', 'title');
      assert
        .dom('[data-test-result="3"]')
        .hasAttribute('data-test-url-field', 'nps_link');
      assert
        .dom('[data-test-result] button')
        .doesNotExist('no click handler unless tracking');
    });

    test('it wraps results in @view', async function (assert) {
      const d = (driver = createDriver());
      await render(
        <template>
          <ResultsContainer
            @driver={{d}}
            @view={{ListView}}
            @resultView={{ResultView}}
            @titleField="title"
            class="wrapper"
          />
        </template>,
      );
      await searchSettled(d);
      assert
        .dom('[data-test-list].wrapper [data-test-result]')
        .exists({ count: 5 });
    });

    test('@shouldTrackClickThrough tracks clicks on results', async function (assert) {
      const clicks: { documentId: string; tags: string[] }[] = [];
      const d = (driver = createDriver({
        onResultClick: (args: (typeof clicks)[number]) => {
          clicks.push(args);
        },
      }));
      await render(
        <template>
          <ResultsContainer
            @driver={{d}}
            @resultView={{ResultView}}
            @titleField="title"
            @shouldTrackClickThrough={{true}}
          />
        </template>,
      );
      await searchSettled(d);
      await click('[data-test-result="2"] button');
      assert.strictEqual(clicks.length, 1);
      assert.strictEqual(clicks[0]?.documentId, '2');
      assert.deepEqual(clicks[0]?.tags, [], 'no tags by default');
    });

    test('@clickThroughTags are sent with tracked clicks', async function (assert) {
      const clicks: { documentId: string; tags: string[] }[] = [];
      const d = (driver = createDriver({
        onResultClick: (args: (typeof clicks)[number]) => {
          clicks.push(args);
        },
      }));
      const tags = ['promo', 'home'];
      await render(
        <template>
          <ResultsContainer
            @driver={{d}}
            @resultView={{ResultView}}
            @titleField="title"
            @shouldTrackClickThrough={{true}}
            @clickThroughTags={{tags}}
          />
        </template>,
      );
      await searchSettled(d);
      await click('[data-test-result="3"] button');
      assert.deepEqual(
        clicks.map((c) => [c.documentId, c.tags]),
        [['3', ['promo', 'home']]],
      );
    });

    test('Result yields an onClickLink that tracks with @clickThroughTags', async function (assert) {
      const clicks: { documentId: string; tags: string[] }[] = [];
      const d = (driver = createDriver({
        onResultClick: (args: (typeof clicks)[number]) => {
          clicks.push(args);
        },
      }));
      const result = { id: { raw: '9' }, title: { raw: 'Denali' } };
      const tags = ['ad'];
      await render(
        <template>
          <ResultContainer
            @driver={{d}}
            @result={{result}}
            @shouldTrackClickThrough={{true}}
            @clickThroughTags={{tags}}
            as |r|
          >
            <button
              type="button"
              {{on "click" (optional r.onClickLink)}}
            >go</button>
          </ResultContainer>
        </template>,
      );
      await click('button');
      assert.deepEqual(
        clicks.map((c) => [c.documentId, c.tags]),
        [['9', ['ad']]],
      );
    });

    test('Result yields its state when no @view is given', async function (assert) {
      const d = (driver = createDriver());
      const result = { id: { raw: '9' }, title: { raw: 'Denali' } };
      await render(
        <template>
          <ResultContainer
            @driver={{d}}
            @result={{result}}
            @titleField="title"
            as |r|
          >
            {{rawOf r.result "title"}}
            {{r.titleField}}
            {{if r.onClickLink "tracked" "untracked"}}
          </ResultContainer>
        </template>,
      );
      assert.dom().hasText('Denali title untracked');
    });
  });
});
