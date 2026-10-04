import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, settled } from '@ember/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';
import type { FilterValue } from '@elastic/search-ui';
import BooleanFacet from '#src/components/boolean-facet.gts';
import Facets from '#src/components/facets.gts';
import Layout from '#src/components/layout.gts';
import LayoutSidebar from '#src/components/layout-sidebar.gts';
import MultiCheckboxFacet from '#src/components/multi-checkbox-facet.gts';
import Result from '#src/components/result.gts';
import SingleLinksFacet from '#src/components/single-links-facet.gts';
import SingleSelectFacet from '#src/components/single-select-facet.gts';
import { Box } from '../helpers/tracked-box.ts';

// View components that only take args (no driver).
module('Integration | Views | presentational components', function (hooks) {
  setupRenderingTest(hooks);

  let calls: [string, unknown][];
  const record = (name: string) => (value?: unknown) => {
    calls.push([name, value]);
  };
  const select = record('select');
  const remove = record('remove');
  const more = record('more');
  const search = record('search');
  const change = record('change');
  const clickLink = record('click');
  const noop = () => {};

  hooks.beforeEach(function () {
    calls = [];
  });

  module('MultiCheckboxFacet', function () {
    test('it renders options with counts and toggles them', async function (assert) {
      const options = [
        { value: 'California', count: 1234, selected: true },
        { value: { name: 'Small', from: 0 }, count: 2, selected: false },
      ];
      await render(
        <template>
          <MultiCheckboxFacet
            @label="States"
            @options={{options}}
            @onSelect={{select}}
            @onRemove={{remove}}
            @onChange={{noop}}
            @onMoreClick={{more}}
            @showMore={{true}}
            class="extra"
          />
        </template>,
      );
      assert.dom('fieldset.sui-facet.extra legend').hasText('States');
      assert
        .dom('.sui-multi-checkbox-facet__option-label')
        .exists({ count: 2 });
      assert.dom('#example_facet_StatesCalifornia').isChecked();
      assert.dom('#example_facet_StatesSmall').isNotChecked();
      assert
        .dom(
          'label[for="example_facet_StatesSmall"] .sui-multi-checkbox-facet__input-text',
        )
        .hasText('Small');
      assert
        .dom(
          'label[for="example_facet_StatesCalifornia"] .sui-multi-checkbox-facet__option-count',
        )
        .hasText('1,234');

      await click('#example_facet_StatesCalifornia');
      await click('#example_facet_StatesSmall');
      await click('.sui-facet-view-more');
      assert.deepEqual(
        calls.map(([name, value]) => [
          name,
          (value as { name?: string } | undefined)?.name ??
            (typeof value === 'string' ? value : 'event'),
        ]),
        [
          ['remove', 'California'],
          ['select', 'Small'],
          ['more', 'event'],
        ],
      );
    });

    test('it shows the empty state, search input and hides "more"', async function (assert) {
      const none: never[] = [];
      await render(
        <template>
          <MultiCheckboxFacet
            @label="States"
            @options={{none}}
            @showSearch={{true}}
            @searchPlaceholder="Filter states"
            @onSearch={{search}}
            @onSelect={{noop}}
            @onRemove={{noop}}
            @onChange={{noop}}
          />
        </template>,
      );
      assert.dom('.sui-multi-checkbox-facet').hasText('No matching options');
      assert
        .dom('.sui-facet-search__text-input')
        .hasAttribute('placeholder', 'Filter states');
      assert.dom('.sui-facet-view-more').doesNotExist();
    });
  });

  module('BooleanFacet', function () {
    test('it renders the "true" option and toggles it', async function (assert) {
      const options = [
        { value: 'true', count: 7, selected: false },
        { value: 'false', count: 3, selected: false },
      ];
      const values = new Box<FilterValue[]>([]);
      await render(
        <template>
          <BooleanFacet
            @label="Heritage site"
            @options={{options}}
            @values={{values.value}}
            @onChange={{change}}
            @onRemove={{remove}}
            @onSelect={{noop}}
          />
        </template>,
      );
      assert.dom('.sui-facet__title').hasText('Heritage site');
      assert.dom('.sui-boolean-facet__option-count').hasText('7');
      assert.dom('.sui-boolean-facet__checkbox').isNotChecked();
      await click('.sui-boolean-facet__checkbox');

      values.value = ['true'];
      await settled();
      assert.dom('.sui-boolean-facet__checkbox').isChecked();
      await click('.sui-boolean-facet__checkbox');
      assert.deepEqual(
        calls.map(([name, value]) => [
          name,
          typeof value === 'string' ? value : 'event',
        ]),
        [
          ['change', 'true'],
          ['remove', 'true'],
        ],
      );
    });

    test('it renders nothing without a "true" option', async function (assert) {
      const options = [{ value: 'false', count: 3, selected: false }];
      const none: FilterValue[] = [];
      await render(
        <template>
          <BooleanFacet
            @label="X"
            @options={{options}}
            @values={{none}}
            @onChange={{noop}}
            @onRemove={{noop}}
            @onSelect={{noop}}
          />
        </template>,
      );
      assert.dom('.sui-facet').doesNotExist();
    });
  });

  module('SingleLinksFacet', function () {
    test('it lists options as links and shows the selected one', async function (assert) {
      const options = new Box([
        { value: 'Utah', count: 1, selected: false },
        { value: { name: 'Big' }, count: 4, selected: false },
      ]);
      await render(
        <template>
          <SingleLinksFacet
            @label="States"
            @options={{options.value}}
            @onSelect={{select}}
            @onRemove={{remove}}
            @onChange={{noop}}
          />
        </template>,
      );
      assert.dom('.sui-facet__title').hasText('States');
      assert.dom('.sui-single-option-facet__link').exists({ count: 2 });
      assert
        .dom('.sui-single-option-facet__item:nth-child(2)')
        .hasText('Big 4');
      await click('.sui-single-option-facet__item:nth-child(1) a');

      options.value = [
        { value: 'Utah', count: 1, selected: true },
        { value: { name: 'Big' }, count: 4, selected: false },
      ];
      await settled();
      assert.dom('.sui-single-option-facet__link').doesNotExist();
      assert.dom('.sui-single-option-facet__selected').includesText('Utah');
      await click('.sui-single-option-facet__remove a');
      assert.deepEqual(
        calls.map(([name, value]) => [
          name,
          typeof value === 'string' ? value : 'event',
        ]),
        [
          ['select', 'Utah'],
          ['remove', 'Utah'],
        ],
      );
    });
  });

  module('SingleSelectFacet', function () {
    test('it renders a select with the selected option and changes value', async function (assert) {
      const options = [
        { value: 'Utah', count: 1000, selected: false },
        { value: 'Maine', count: 2, selected: true },
      ];
      await render(
        <template>
          <SingleSelectFacet
            @label="States"
            @options={{options}}
            @onChange={{change}}
            @onSelect={{noop}}
            @onRemove={{noop}}
          />
        </template>,
      );
      assert.dom('.sui-facet__title').hasText('States');
      assert.dom('.sui-select__control').includesText('Maine');

      await selectChoose('.sui-select', '.ember-power-select-option', 0);
      assert.deepEqual(calls, [['change', 'Utah']]);
    });
  });

  module('Layout / LayoutSidebar / Facets', function () {
    test('Layout renders named blocks into their regions', async function (assert) {
      await render(
        <template>
          <Layout class="custom">
            <:header>H</:header>
            <:sideContent>S</:sideContent>
            <:bodyHeader>BH</:bodyHeader>
            <:bodyContent>BC</:bodyContent>
            <:bodyFooter>BF</:bodyFooter>
          </Layout>
        </template>,
      );
      assert.dom('.sui-layout.custom').exists();
      assert.dom('.sui-layout-header__inner').hasText('H');
      assert
        .dom('.sui-layout-body__inner > div.sui-layout-sidebar')
        .hasText('Save Filters S');
      assert.dom('.sui-layout-main-header__inner').hasText('BH');
      assert.dom('.sui-layout-main-body').hasText('BC');
      assert.dom('.sui-layout-main-footer').hasText('BF');
    });

    test('LayoutSidebar toggles its state class', async function (assert) {
      await render(
        <template>
          <LayoutSidebar data-test-sidebar>filters</LayoutSidebar>
        </template>,
      );
      assert.dom('[data-test-sidebar]').hasClass('sui-layout-sidebar--');
      await click('.sui-layout-sidebar-toggle');
      assert.dom('[data-test-sidebar]').hasClass('sui-layout-sidebar--toggled');
    });

    test('Facets wraps its block', async function (assert) {
      await render(
        <template>
          <Facets class="x">inside</Facets>
        </template>,
      );
      assert.dom('.sui-facet-container.x').hasText('inside');
    });
  });

  module('Result', function () {
    test('it renders the title as a link when the url is safe', async function (assert) {
      const result = {
        id: { raw: '1' },
        title: { raw: 'Yosemite', snippet: '<em>Yos</em>emite' },
        nps_link: { raw: 'https://www.nps.gov/yose' },
        _meta: { score: 1 },
      };
      await render(
        <template>
          <Result
            @result={{result}}
            @titleField="title"
            @urlField="nps_link"
            @onClickLink={{clickLink}}
          />
        </template>,
      );
      assert
        .dom('a.sui-result__title-link')
        .hasAttribute('href', 'https://www.nps.gov/yose');
      assert
        .dom('a.sui-result__title-link em')
        .hasText('Yos', 'snippets render as HTML');
      assert
        .dom('.sui-result__details > li')
        .exists({ count: 3 }, 'non-wrapper fields are omitted');
      assert
        .dom('.sui-result__details > li:first-child .sui-result__key')
        .hasText('id');
      document
        .querySelector('a.sui-result__title-link')!
        .addEventListener('click', (e) => e.preventDefault());
      await click('a.sui-result__title-link');
      assert.strictEqual(calls.length, 1);
    });

    test('it renders a plain title when the url is unsafe', async function (assert) {
      const result = {
        title: { raw: '<b>Acadia</b>' },
        url: { raw: 'javascript:alert(1)' },
      };
      await render(
        <template>
          <Result @result={{result}} @titleField="title" @urlField="url" />
        </template>,
      );
      assert.dom('a').doesNotExist();
      assert
        .dom('span.sui-result__title')
        .hasText('<b>Acadia</b>', 'raw values are escaped');
    });
  });
});
