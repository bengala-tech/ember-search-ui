import { module, test } from 'qunit';
import { getFilterValueDisplay } from 'ember-search-ui-views/helpers/get-filter-value-display';
import { getSuggestionTitle } from 'ember-search-ui-views/helpers/get-suggestion-title';
import { getUrlSanitizer } from 'ember-search-ui-views/helpers/get-url-sanitizer';

module('Unit | Helper | misc view helpers', function () {
  test('getFilterValueDisplay renders strings, numbers and named ranges', function (assert) {
    assert.strictEqual(getFilterValueDisplay('Utah'), 'Utah');
    assert.strictEqual(getFilterValueDisplay(12), '12');
    assert.strictEqual(getFilterValueDisplay(false), 'false');
    assert.strictEqual(getFilterValueDisplay({ name: 'Small', from: 0 }), 'Small');
    assert.strictEqual(getFilterValueDisplay(undefined), '');
    assert.strictEqual(getFilterValueDisplay(null), '');
  });

  test('getSuggestionTitle prefers a global sectionTitle', function (assert) {
    assert.strictEqual(getSuggestionTitle('documents', { sectionTitle: 'All' }), 'All');
    assert.strictEqual(
      getSuggestionTitle('documents', { documents: { sectionTitle: 'Docs' } }),
      'Docs'
    );
    assert.strictEqual(getSuggestionTitle('documents', {}), undefined);
  });

  test('getUrlSanitizer only allows http(s) urls', function (assert) {
    let sanitize = getUrlSanitizer(URL, 'https://example.com/search');
    assert.strictEqual(sanitize('https://nps.gov'), 'https://nps.gov');
    assert.strictEqual(sanitize('http://nps.gov'), 'http://nps.gov');
    assert.strictEqual(sanitize('/relative/path'), '/relative/path', 'relative urls resolve against location');
    assert.strictEqual(sanitize('javascript:alert(1)'), '');
    assert.strictEqual(sanitize('data:text/html,hi'), '');
  });

  test('getUrlSanitizer returns empty string for unparsable urls', function (assert) {
    let sanitize = getUrlSanitizer(URL, undefined);
    assert.strictEqual(sanitize('not a url'), '');
  });
});
