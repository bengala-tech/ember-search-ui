import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { selectChoose } from 'ember-power-select/test-support';

// View components from ember-search-ui-views that only take args (no driver).
module('Integration | Views | presentational components', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    this.calls = [];
    for (let name of ['select', 'remove', 'more', 'search', 'change', 'click']) {
      this[name] = (value) => this.calls.push([name, value]);
    }
  });

  module('MultiCheckboxFacet', function () {
    test('it renders options with counts and toggles them', async function (assert) {
      this.options = [
        { value: 'California', count: 1234, selected: true },
        { value: { name: 'Small', from: 0 }, count: 2, selected: false },
      ];
      await render(hbs`
        <MultiCheckboxFacet
          @label="States"
          @options={{this.options}}
          @onSelect={{this.select}}
          @onRemove={{this.remove}}
          @onMoreClick={{this.more}}
          @showMore={{true}}
          class="extra"
        />
      `);
      assert.dom('fieldset.sui-facet.extra legend').hasText('States');
      assert.dom('.sui-multi-checkbox-facet__option-label').exists({ count: 2 });
      assert.dom('#example_facet_StatesCalifornia').isChecked();
      assert.dom('#example_facet_StatesSmall').isNotChecked();
      assert.dom('label[for="example_facet_StatesSmall"] .sui-multi-checkbox-facet__input-text').hasText('Small');
      assert.dom('label[for="example_facet_StatesCalifornia"] .sui-multi-checkbox-facet__option-count').hasText('1,234');

      await click('#example_facet_StatesCalifornia');
      await click('#example_facet_StatesSmall');
      await click('.sui-facet-view-more');
      assert.deepEqual(
        this.calls.map(([name, value]) => [name, value?.name ?? (typeof value === 'string' ? value : 'event')]),
        [
          ['remove', 'California'],
          ['select', 'Small'],
          ['more', 'event'],
        ]
      );
    });

    test('it shows the empty state, search input and hides "more"', async function (assert) {
      await render(hbs`
        <MultiCheckboxFacet @label="States" @options={{(array)}} @showSearch={{true}} @searchPlaceholder="Filter states" @onSearch={{this.search}} />
      `);
      assert.dom('.sui-multi-checkbox-facet').hasText('No matching options');
      assert.dom('.sui-facet-search__text-input').hasAttribute('placeholder', 'Filter states');
      assert.dom('.sui-facet-view-more').doesNotExist();
    });
  });

  module('BooleanFacet', function () {
    test('it renders the "true" option and toggles it', async function (assert) {
      this.options = [
        { value: 'true', count: 7 },
        { value: 'false', count: 3 },
      ];
      this.set('values', []);
      await render(hbs`
        <BooleanFacet @label="Heritage site" @options={{this.options}} @values={{this.values}} @onChange={{this.change}} @onRemove={{this.remove}} />
      `);
      assert.dom('.sui-facet__title').hasText('Heritage site');
      assert.dom('.sui-boolean-facet__option-count').hasText('7');
      assert.dom('.sui-boolean-facet__checkbox').isNotChecked();
      await click('.sui-boolean-facet__checkbox');

      this.set('values', ['true']);
      assert.dom('.sui-boolean-facet__checkbox').isChecked();
      await click('.sui-boolean-facet__checkbox');
      assert.deepEqual(this.calls, [
        ['change', 'true'],
        ['remove', 'true'],
      ]);
    });

    test('it renders nothing without a "true" option', async function (assert) {
      this.options = [{ value: 'false', count: 3 }];
      await render(hbs`<BooleanFacet @label="X" @options={{this.options}} @values={{(array)}} />`);
      assert.dom('.sui-facet').doesNotExist();
    });
  });

  module('SingleLinksFacet', function () {
    test('it lists options as links and shows the selected one', async function (assert) {
      this.set('options', [
        { value: 'Utah', count: 1 },
        { value: { name: 'Big' }, count: 4 },
      ]);
      await render(hbs`
        <SingleLinksFacet @label="States" @options={{this.options}} @onSelect={{this.select}} @onRemove={{this.remove}} />
      `);
      assert.dom('.sui-facet__title').hasText('States');
      assert.dom('.sui-single-option-facet__link').exists({ count: 2 });
      assert.dom('.sui-single-option-facet__item:nth-child(2)').hasText('Big 4');
      await click('.sui-single-option-facet__item:nth-child(1) a');

      this.set('options', [
        { value: 'Utah', count: 1, selected: true },
        { value: { name: 'Big' }, count: 4 },
      ]);
      assert.dom('.sui-single-option-facet__link').doesNotExist();
      assert.dom('.sui-single-option-facet__selected').includesText('Utah');
      await click('.sui-single-option-facet__remove a');
      assert.deepEqual(this.calls, [
        ['select', 'Utah'],
        ['remove', 'Utah'],
      ]);
    });
  });

  module('SingleSelectFacet', function () {
    test('it renders a select with the selected option and changes value', async function (assert) {
      this.options = [
        { value: 'Utah', count: 1000 },
        { value: 'Maine', count: 2, selected: true },
      ];
      await render(hbs`<SingleSelectFacet @label="States" @options={{this.options}} @onChange={{this.change}} />`);
      assert.dom('.sui-facet__title').hasText('States');
      assert.dom('.sui-select__control').includesText('Maine');

      await selectChoose('.sui-select', '.ember-power-select-option', 0);
      assert.deepEqual(this.calls, [['change', 'Utah']]);
    });
  });

  module('Layout / LayoutSidebar / Facets', function () {
    test('Layout renders named blocks into their regions', async function (assert) {
      await render(hbs`
        <Layout class="custom">
          <:header>H</:header>
          <:sideContent>S</:sideContent>
          <:bodyHeader>BH</:bodyHeader>
          <:bodyContent>BC</:bodyContent>
          <:bodyFooter>BF</:bodyFooter>
        </Layout>
      `);
      assert.dom('.sui-layout.custom').exists();
      assert.dom('.sui-layout-header__inner').hasText('H');
      assert.dom('.sui-layout-body__inner > div.sui-layout-sidebar').hasText('Save Filters S');
      assert.dom('.sui-layout-main-header__inner').hasText('BH');
      assert.dom('.sui-layout-main-body').hasText('BC');
      assert.dom('.sui-layout-main-footer').hasText('BF');
    });

    test('LayoutSidebar toggles its state class', async function (assert) {
      await render(hbs`<LayoutSidebar data-test-sidebar>filters</LayoutSidebar>`);
      assert.dom('[data-test-sidebar]').hasClass('sui-layout-sidebar--');
      await click('.sui-layout-sidebar-toggle');
      assert.dom('[data-test-sidebar]').hasClass('sui-layout-sidebar--toggled');
    });

    test('Facets wraps its block', async function (assert) {
      await render(hbs`<Facets class="x">inside</Facets>`);
      assert.dom('.sui-facet-container.x').hasText('inside');
    });
  });

  module('Result', function () {
    test('it renders the title as a link when the url is safe', async function (assert) {
      this.result = {
        id: { raw: '1' },
        title: { raw: 'Yosemite', snippet: '<em>Yos</em>emite' },
        nps_link: { raw: 'https://www.nps.gov/yose' },
        _meta: { score: 1 },
      };
      await render(hbs`<Result @result={{this.result}} @titleField="title" @urlField="nps_link" @onClickLink={{this.click}} />`);
      assert.dom('a.sui-result__title-link').hasAttribute('href', 'https://www.nps.gov/yose');
      assert.dom('a.sui-result__title-link em').hasText('Yos', 'snippets render as HTML');
      assert.dom('.sui-result__details > li').exists({ count: 3 }, 'non-wrapper fields are omitted');
      assert.dom('.sui-result__details > li:first-child .sui-result__key').hasText('id');
      await click('a.sui-result__title-link');
      assert.strictEqual(this.calls.length, 1);
    });

    test('it renders a plain title when the url is unsafe', async function (assert) {
      this.result = { title: { raw: '<b>Acadia</b>' }, url: { raw: 'javascript:alert(1)' } };
      await render(hbs`<Result @result={{this.result}} @titleField="title" @urlField="url" />`);
      assert.dom('a').doesNotExist();
      assert.dom('span.sui-result__title').hasText('<b>Acadia</b>', 'raw values are escaped');
    });
  });
});
