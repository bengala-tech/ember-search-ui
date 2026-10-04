import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';

module('Integration | Helper | template-only view helpers', function (hooks) {
  setupRenderingTest(hooks);

  test('to-locale-string formats numbers and tolerates undefined', async function (assert) {
    await render(hbs`<span data-test-a>{{to-locale-string 1234567 "en"}}</span><span data-test-b>{{to-locale-string this.missing}}</span>`);
    assert.dom('[data-test-a]').hasText('1,234,567');
    assert.dom('[data-test-b]').hasText('');
  });

  test('wrap-options turns values into label/value pairs', async function (assert) {
    this.options = [20, 40];
    await render(hbs`{{#each (wrap-options this.options) as |o|}}[{{o.label}}={{o.value}}]{{/each}}`);
    assert.dom(this.element).hasText('[20=20][40=40]');
  });

  test('map-facet-options maps facet values and picks the first selected', async function (assert) {
    this.options = [
      { value: 'Utah', count: 1 },
      { value: { name: 'Small', from: 0 }, count: 2, selected: true },
      { value: 'Maine', count: 3, selected: true },
    ];
    await render(hbs`
      {{#let (map-facet-options this.options) as |m|}}
        <span data-test-options>{{#each m.options as |o|}}[{{o.label}}:{{o.count}}]{{/each}}</span>
        <span data-test-selected>{{m.selectedSelectBoxOption.label}}</span>
      {{/let}}
    `);
    assert.dom('[data-test-options]').hasText('[Utah:1][Small:2][Maine:3]');
    assert.dom('[data-test-selected]').hasText('Small');
  });

  test('get-escaped-fields keeps only field wrappers and escapes them', async function (assert) {
    this.result = {
      title: { raw: '<b>Zion</b>' },
      body: { snippet: '<em>red</em> rocks' },
      _meta: { id: '1' },
      score: 4,
    };
    await render(hbs`
      {{#each-in (get-escaped-fields this.result) as |key value|}}
        <span data-test-field={{key}}>{{value}}</span>
      {{/each-in}}
    `);
    assert.dom('[data-test-field]').exists({ count: 2 });
    assert.dom('[data-test-field="title"]').hasText('&lt;b&gt;Zion&lt;/b&gt;');
    assert.dom('[data-test-field="body"]').hasText('<em>red</em> rocks');
  });

  test('build-autocomplete-groups builds suggestion and result groups', async function (assert) {
    this.suggestions = {
      documents: [{ suggestion: 'zion' }, { suggestion: 'yosemite', highlight: '<em>yo</em>semite' }],
    };
    this.results = [{ title: { raw: 'Zion', snippet: '<em>Z</em>ion' } }, { title: { raw: 'Acadia' } }];
    this.autocompleteResults = { sectionTitle: 'Results', titleField: 'title' };
    this.autocompleteSuggestions = { documents: { sectionTitle: 'Suggested' } };
    await render(hbs`
      {{#each (build-autocomplete-groups
        autocompletedSuggestions=this.suggestions
        autocompletedResults=this.results
        autocompleteResults=this.autocompleteResults
        autocompleteSuggestions=this.autocompleteSuggestions
      ) as |group|}}
        <div data-test-group class={{group.class}} data-test-suggestion={{if group.isSuggestionGroup "yes" "no"}}>
          <h3>{{group.groupName}}</h3>
          <span data-test-count>{{group.options.length}}</span>
        </div>
      {{/each}}
    `);
    assert.dom('[data-test-group]').exists({ count: 2 });
    assert.dom('.sui-search-box__suggestion-list h3').hasText('Suggested');
    assert.dom('.sui-search-box__suggestion-list').hasAttribute('data-test-suggestion', 'yes');
    assert.dom('.sui-search-box__result-list h3').hasText('Results');
    assert.dom('.sui-search-box__result-list').hasAttribute('data-test-suggestion', 'no');
    assert.dom('.sui-search-box__suggestion-list [data-test-count]').hasText('2');
    assert.dom('.sui-search-box__result-list [data-test-count]').hasText('2');
  });
});
