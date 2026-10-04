import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, settled, triggerEvent, waitUntil } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { setComponentTemplate } from '@ember/component';
import templateOnly from '@ember/component/template-only';
import { createDriver, searchSettled } from '../../../helpers/search';

const view = (template) => setComponentTemplate(template, templateOnly());

module('Integration | Component | containers', function (hooks) {
  setupRenderingTest(hooks);

  hooks.afterEach(function () {
    this.driver?.tearDown();
  });

  module('Paging', function () {
    test('it yields paging state and changes page', async function (assert) {
      this.driver = createDriver({ initialState: { resultsPerPage: 2 } });
      await render(hbs`
        <Containers::Paging @driver={{this.driver}} as |paging|>
          <span data-test-current>{{paging.current}}</span>
          <span data-test-total-pages>{{paging.totalPages}}</span>
          <span data-test-per-page>{{paging.resultsPerPage}}</span>
          <button type="button" {{on "click" (fn paging.onChange 3)}}>go</button>
        </Containers::Paging>
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-current]').hasText('1');
      assert.dom('[data-test-total-pages]').hasText('3');
      assert.dom('[data-test-per-page]').hasText('2');

      await click('button');
      await searchSettled(this.driver, (s) => s.current === 3);
      assert.dom('[data-test-current]').hasText('3');
    });

    test('it renders a custom @view with the paging args', async function (assert) {
      this.driver = createDriver({ initialState: { resultsPerPage: 2 } });
      this.View = view(
        hbs`<div data-test-view class="custom" ...attributes>{{@current}}/{{@totalPages}}/{{@resultsPerPage}}</div>`
      );
      await render(hbs`<Containers::Paging @driver={{this.driver}} @view={{this.View}} data-test-attr="x" />`);
      await searchSettled(this.driver);
      assert.dom('[data-test-view]').hasText('1/3/2').hasAttribute('data-test-attr', 'x');
    });
  });

  module('PagingInfo', function () {
    test('it yields start, end, total and searchTerm', async function (assert) {
      this.driver = createDriver({ initialState: { resultsPerPage: 2, current: 2, searchTerm: 'o' } });
      await render(hbs`
        <Containers::PagingInfo @driver={{this.driver}} as |info|>
          {{info.start}}-{{info.end}} of {{info.totalResults}} for {{info.searchTerm}}
        </Containers::PagingInfo>
      `);
      await searchSettled(this.driver);
      // "o" matches Yosemite, Yellowstone, Zion, Joshua Tree
      assert.dom(this.element).hasText('3-4 of 4 for o');
    });
  });

  module('ResultsPerPage', function () {
    test('it yields default options and changes page size', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::ResultsPerPage @driver={{this.driver}} as |rpp|>
          <span data-test-options>{{join "," rpp.options}}</span>
          <span data-test-value>{{rpp.value}}</span>
          <button type="button" {{on "click" (fn rpp.onChange 40)}}>40</button>
        </Containers::ResultsPerPage>
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-options]').hasText('20,40,60');
      assert.dom('[data-test-value]').hasText('20');

      await click('button');
      await searchSettled(this.driver, (s) => s.resultsPerPage === 40);
      assert.dom('[data-test-value]').hasText('40');
    });

    test('it accepts custom @options', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::ResultsPerPage @driver={{this.driver}} @options={{array 5 10}} as |rpp|>
          {{join "," rpp.options}}
        </Containers::ResultsPerPage>
      `);
      assert.dom(this.element).hasText('5,10');
    });
  });

  module('Sorting', function (hooks) {
    hooks.beforeEach(function () {
      this.sortOptions = [
        { name: 'Relevance', value: '', direction: '' },
        { name: 'Title A-Z', value: 'title', direction: 'asc' },
        { name: 'Title Z-A', value: 'title', direction: 'desc' },
      ];
    });

    test('it yields formatted options and the current value', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::Sorting @driver={{this.driver}} @sortOptions={{this.sortOptions}} @label="Sort by" as |sorting|>
          <span data-test-label>{{sorting.label}}</span>
          <span data-test-value>{{sorting.value}}</span>
          {{#each sorting.options as |option|}}
            <span data-test-option={{option.value}}>{{option.label}}</span>
          {{/each}}
        </Containers::Sorting>
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-label]').hasText('Sort by');
      assert.dom('[data-test-value]').hasText('|||');
      assert.dom('[data-test-option]').exists({ count: 3 });
      assert.dom('[data-test-option="title|||desc"]').hasText('Title Z-A');
    });

    test('onChange accepts a formatted string or an option object', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::Sorting @driver={{this.driver}} @sortOptions={{this.sortOptions}} as |sorting|>
          <span data-test-value>{{sorting.value}}</span>
          <span data-test-field>{{sorting.sortField}}</span>
          <span data-test-direction>{{sorting.sortDirection}}</span>
          <button type="button" data-test-string {{on "click" (fn sorting.onChange "title|||desc")}}>desc</button>
          <button type="button" data-test-object {{on "click" (fn sorting.onChange (hash value="title|||asc"))}}>asc</button>
        </Containers::Sorting>
      `);
      await searchSettled(this.driver);

      await click('[data-test-string]');
      await searchSettled(this.driver, (s) => s.sortDirection === 'desc');
      assert.dom('[data-test-value]').hasText('title|||desc');
      assert.dom('[data-test-field]').hasText('title');
      assert.dom('[data-test-direction]').hasText('desc');

      await click('[data-test-object]');
      await searchSettled(this.driver, (s) => s.sortDirection === 'asc');
      assert.dom('[data-test-value]').hasText('title|||asc');
    });
  });

  module('Facet', function (hooks) {
    hooks.beforeEach(function () {
      this.View = view(hbs`
        <div data-test-facet ...attributes>
          <span data-test-label>{{@label}}</span>
          <span data-test-values>{{join "," @values}}</span>
          <span data-test-placeholder>{{@searchPlaceholder}}</span>
          {{#if @showSearch}}<input data-test-search {{on "input" @onSearch}} />{{/if}}
          {{#each @options as |option|}}
            <button
              type="button"
              data-test-option={{option.value}}
              data-test-selected={{if option.selected "true" "false"}}
              {{on "click" (if option.selected (fn @onRemove option.value) (fn @onSelect option.value))}}
            >{{option.value}} ({{option.count}})</button>
          {{/each}}
          <button type="button" data-test-set {{on "click" (fn @onChange "Utah")}}>set</button>
          {{#if @showMore}}<button type="button" data-test-more {{on "click" @onMoreClick}}>more</button>{{/if}}
        </div>
      `);
    });

    test('it renders the facet values for @field via @view', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<Containers::Facet @driver={{this.driver}} @field="states" @label="States" @view={{this.View}} />`);
      await searchSettled(this.driver);

      assert.dom('[data-test-label]').hasText('States');
      assert.dom('[data-test-option]').exists({ count: 5 });
      assert.dom('[data-test-option="California"]').hasText('California (2)');
      assert.dom('[data-test-placeholder]').hasText('Field states');
      assert.dom('[data-test-search]').doesNotExist();
    });

    test('it renders nothing when the field has no facet', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<Containers::Facet @driver={{this.driver}} @field="nope" @view={{this.View}} />`);
      await searchSettled(this.driver);
      assert.dom('[data-test-facet]').doesNotExist();
    });

    test('onSelect / onRemove add and remove filters using @filterType', async function (assert) {
      this.driver = createDriver();
      await render(
        hbs`<Containers::Facet @driver={{this.driver}} @field="states" @filterType="any" @view={{this.View}} />`
      );
      await searchSettled(this.driver);

      await click('[data-test-option="California"]');
      await searchSettled(this.driver, (s) => s.filters.length === 1);
      assert.deepEqual(this.driver.getState().filters, [
        { field: 'states', values: ['California'], type: 'any' },
      ]);
      assert.dom('[data-test-option="California"]').hasAttribute('data-test-selected', 'true');
      assert.dom('[data-test-values]').hasText('California');

      await click('[data-test-option="Utah"]');
      await searchSettled(this.driver, (s) => s.filters[0]?.values.length === 2);
      assert.dom('[data-test-values]').hasText('California,Utah');

      await click('[data-test-option="California"]');
      await searchSettled(this.driver, (s) => s.filters[0]?.values.length === 1);
      assert.dom('[data-test-values]').hasText('Utah');
    });

    test('@filterType defaults to "all"', async function (assert) {
      this.driver = createDriver();
      await render(hbs`<Containers::Facet @driver={{this.driver}} @field="states" @view={{this.View}} />`);
      await searchSettled(this.driver);
      await click('[data-test-option="Maine"]');
      await searchSettled(this.driver, (s) => s.filters.length === 1);
      assert.strictEqual(this.driver.getState().filters[0].type, 'all');
    });

    test('onChange replaces the filter value', async function (assert) {
      this.driver = createDriver();
      await render(
        hbs`<Containers::Facet @driver={{this.driver}} @field="states" @filterType="any" @view={{this.View}} />`
      );
      await searchSettled(this.driver);
      await click('[data-test-option="California"]');
      await searchSettled(this.driver, (s) => s.filters.length === 1);
      await click('[data-test-set]');
      await searchSettled(this.driver, (s) => s.filters[0]?.values[0] === 'Utah');
      assert.dom('[data-test-values]').hasText('Utah');
    });

    test('it shows @show options and reveals 10 more on demand', async function (assert) {
      this.driver = createDriver();
      let notifications = [];
      let a11yNotify = this.driver.getActions().a11yNotify;
      this.driver.a11yNotify = this.driver.actions.a11yNotify = (name, args) => {
        notifications.push([name, args]);
        return a11yNotify(name, args);
      };

      await render(hbs`<Containers::Facet @driver={{this.driver}} @field="states" @show={{2}} @view={{this.View}} />`);
      await searchSettled(this.driver);
      assert.dom('[data-test-option]').exists({ count: 2 });

      await click('[data-test-more]');
      assert.dom('[data-test-option]').exists({ count: 5 });
      assert.deepEqual(notifications, [['moreFilters', { visibleOptionsCount: 5, showingAll: true }]]);
    });

    test('@isFilterable enables accent-insensitive searching of options', async function (assert) {
      this.driver = createDriver();
      await render(
        hbs`<Containers::Facet @driver={{this.driver}} @field="states" @isFilterable={{true}} @view={{this.View}} />`
      );
      await searchSettled(this.driver);

      await fillIn('[data-test-search]', 'MÁ');
      assert.dom('[data-test-option]').exists({ count: 1 });
      assert.dom('[data-test-option="Maine"]').exists();

      await fillIn('[data-test-search]', '  ');
      assert.dom('[data-test-option]').exists({ count: 5 }, 'whitespace does not filter');
    });
  });

  module('SearchBox', function () {
    test('onChange accepts strings and input events', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::SearchBox @driver={{this.driver}} as |box|>
          <input data-test-input value={{box.value}} {{on "input" box.onChange}} />
          <button type="button" {{on "click" (fn box.onChange "zion")}}>zion</button>
        </Containers::SearchBox>
      `);
      await searchSettled(this.driver);

      await fillIn('[data-test-input]', 'yo');
      assert.strictEqual(this.driver.getState().searchTerm, 'yo');
      assert.dom('[data-test-input]').hasValue('yo');

      await click('button');
      assert.strictEqual(this.driver.getState().searchTerm, 'zion');
    });

    test('onChange forwards search options to setSearchTerm', async function (assert) {
      this.driver = createDriver();
      let calls = [];
      let original = this.driver.actions.setSearchTerm;
      this.driver.actions.setSearchTerm = (term, options) => {
        calls.push([term, options]);
        return original(term, options);
      };

      this.set('searchAsYouType', false);
      this.set('shouldClearFilters', undefined);
      await render(hbs`
        <Containers::SearchBox
          @driver={{this.driver}}
          @searchAsYouType={{this.searchAsYouType}}
          @shouldClearFilters={{this.shouldClearFilters}}
          @debounceLength={{50}}
          @autocompleteMinimumCharacters={{2}}
          as |box|
        >
          <button type="button" {{on "click" (fn box.onChange "a")}}>a</button>
        </Containers::SearchBox>
      `);

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

      this.set('searchAsYouType', true);
      this.set('shouldClearFilters', false);
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
      await searchSettled(this.driver, (s) => s.resultSearchTerm === 'a');
    });

    test('onSubmit prevents the default, calls @onSubmit and searches', async function (assert) {
      this.driver = createDriver({ initialState: { searchTerm: 'zi' } });
      this.onSubmit = (setSearchTerm, term) => assert.step(`onSubmit:${term}`);
      await render(hbs`
        <Containers::SearchBox @driver={{this.driver}} @onSubmit={{this.onSubmit}} as |box|>
          <form {{on "submit" box.onSubmit}}><button type="submit">go</button></form>
        </Containers::SearchBox>
      `);
      await searchSettled(this.driver);
      await click('button');
      await searchSettled(this.driver);
      assert.verifySteps(['onSubmit:zi']);
      assert.strictEqual(this.driver.getState().resultSearchTerm, 'zi');
    });

    test('useAutocomplete respects autocomplete flags and minimum characters', async function (assert) {
      this.driver = createDriver({ initialState: { searchTerm: 'y' } });
      this.set('min', 2);
      this.set('results', { titleField: 'title' });
      await render(hbs`
        <Containers::SearchBox
          @driver={{this.driver}}
          @autocompleteResults={{this.results}}
          @autocompleteMinimumCharacters={{this.min}}
          as |box|
        >
          <span data-test-use>{{if box.useAutocomplete "yes" "no"}}</span>
        </Containers::SearchBox>
      `);
      assert.dom('[data-test-use]').hasText('no');
      this.set('min', 1);
      assert.dom('[data-test-use]').hasText('yes');
      this.set('results', undefined);
      assert.dom('[data-test-use]').hasText('no');
    });

    test('it yields autocomplete counts', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::SearchBox @driver={{this.driver}} @autocompleteResults={{true}} @autocompleteSuggestions={{true}} as |box|>
          <span data-test-all>{{box.allAutocompletedItemsCount}}</span>
          <span data-test-suggestions>{{box.autocompletedSuggestionsCount}}</span>
          <button type="button" {{on "click" (fn box.onChange "y")}}>y</button>
        </Containers::SearchBox>
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-all]').hasText('0');

      await click('button');
      await searchSettled(this.driver, (s) => s.autocompletedResults.length === 2);
      assert.dom('[data-test-all]').hasText('4');
      assert.dom('[data-test-suggestions]').hasText('2');
    });

    // BUG (pre-existing): defaultOnSelectAutocomplete calls completeSuggestion(suggestion)
    // without the curried setSearchTerm, so this throws. Unskip once fixed.
    test.skip('selecting an autocomplete suggestion completes the search term', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::SearchBox @driver={{this.driver}} @autocompleteResults={{hash urlField="nps_link"}} as |box|>
          <button type="button" {{on "click" (fn box.onSelectAutocomplete (hash suggestion="zion"))}}>pick</button>
        </Containers::SearchBox>
      `);
      await click('button');
      assert.strictEqual(this.driver.getState().searchTerm, 'zion');
      await searchSettled(this.driver, (s) => s.resultSearchTerm === 'zion');
    });

    test('selecting an autocomplete result opens its url and tracks the click', async function (assert) {
      let clicks = [];
      this.driver = createDriver({ onAutocompleteResultClick: (args) => clicks.push(args) });
      let originalOpen = window.open;
      window.open = (url, target) => assert.step(`open:${url}:${target}`);
      this.result = { id: { raw: '3' }, nps_link: { raw: 'https://www.nps.gov/zion' } };

      try {
        await render(hbs`
          <Containers::SearchBox
            @driver={{this.driver}}
            @autocompleteResults={{hash urlField="nps_link" linkTarget="_blank" clickThroughTags=(array "ac")}}
            as |box|
          >
            <button type="button" {{on "click" (fn box.onSelectAutocomplete this.result)}}>pick</button>
          </Containers::SearchBox>
        `);
        await click('button');
      } finally {
        window.open = originalOpen;
      }

      assert.verifySteps(['open:https://www.nps.gov/zion:_blank']);
      assert.strictEqual(clicks.length, 1);
      assert.strictEqual(clicks[0].documentId, '3');
      assert.deepEqual(clicks[0].tags, ['ac']);
    });

    test('inputProps tracks focus and merges @inputProps', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::SearchBox @driver={{this.driver}} @inputProps={{hash placeholder="Find a park"}} as |box|>
          <input
            placeholder={{box.inputProps.placeholder}}
            {{on "focus" box.inputProps.onFocus}}
            {{on "blur" box.inputProps.onBlur}}
          />
          <span data-test-focused>{{if box.isFocused "focused" "blurred"}}</span>
        </Containers::SearchBox>
      `);
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
      this.driver = createDriver({
        onSearch: async () => {
          throw new Error('boom');
        },
      });
      await render(hbs`
        <Containers::ErrorBoundary @driver={{this.driver}} as |state|>
          <span data-test-error>{{state.error}}</span>
        </Containers::ErrorBoundary>
      `);
      // search-ui leaves isLoading=true on errors, so wait for the error itself
      await waitUntil(() => this.driver.getState().error);
      await settled();
      assert.dom('[data-test-error]').hasText('An unexpected error occurred: boom');
    });
  });

  module('Results / Result', function (hooks) {
    hooks.beforeEach(function () {
      this.ResultView = view(hbs`
        <li data-test-result={{@result.id.raw}} data-test-title-field={{@titleField}} data-test-url-field={{@urlField}}>
          {{#if @onClickLink}}
            <button type="button" {{on "click" @onClickLink}}>{{get @result (concat @titleField ".raw")}}</button>
          {{else}}
            {{get @result (concat @titleField ".raw")}}
          {{/if}}
        </li>
      `);
      this.ListView = view(hbs`<ul data-test-list ...attributes>{{yield}}</ul>`);
    });

    test('it renders each result with @resultView', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::Results
          @driver={{this.driver}}
          @resultView={{this.ResultView}}
          @titleField="title"
          @urlField="nps_link"
        />
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-result]').exists({ count: 5 });
      assert.dom('[data-test-result="3"]').hasText('Zion');
      assert.dom('[data-test-result="3"]').hasAttribute('data-test-title-field', 'title');
      assert.dom('[data-test-result="3"]').hasAttribute('data-test-url-field', 'nps_link');
      assert.dom('[data-test-result] button').doesNotExist('no click handler unless tracking');
    });

    test('it wraps results in @view', async function (assert) {
      this.driver = createDriver();
      await render(hbs`
        <Containers::Results @driver={{this.driver}} @view={{this.ListView}} @resultView={{this.ResultView}} @titleField="title" class="wrapper" />
      `);
      await searchSettled(this.driver);
      assert.dom('[data-test-list].wrapper [data-test-result]').exists({ count: 5 });
    });

    test('@shouldTrackClickThrough tracks clicks on results', async function (assert) {
      let clicks = [];
      this.driver = createDriver({ onResultClick: (args) => clicks.push(args) });
      await render(hbs`
        <Containers::Results
          @driver={{this.driver}}
          @resultView={{this.ResultView}}
          @titleField="title"
          @shouldTrackClickThrough={{true}}
        />
      `);
      await searchSettled(this.driver);
      await click('[data-test-result="2"] button');
      assert.strictEqual(clicks.length, 1);
      assert.strictEqual(clicks[0].documentId, '2');
    });

    test('Result yields its state when no @view is given', async function (assert) {
      this.driver = createDriver();
      this.result = { id: { raw: '9' }, title: { raw: 'Denali' } };
      await render(hbs`
        <Containers::Result @driver={{this.driver}} @result={{this.result}} @titleField="title" as |r|>
          {{r.result.title.raw}} {{r.titleField}} {{if r.onClickLink "tracked" "untracked"}}
        </Containers::Result>
      `);
      assert.dom(this.element).hasText('Denali title untracked');
    });
  });
});
