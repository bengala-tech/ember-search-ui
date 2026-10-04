import { module, test } from 'qunit';
import { getFieldType } from '#src/helpers/get-field-type.ts';
import { getRaw } from '#src/helpers/get-raw.ts';
import { getSnippet } from '#src/helpers/get-snippet.ts';
import { getEscapedField } from '#src/helpers/get-escaped-field.ts';
import { htmlEscape } from '#src/helpers/html-escape.ts';
import { isFieldValueWrapper } from '#src/helpers/is-field-value-wrapper.ts';

const RESULT = {
  title: { raw: 'Rock & <Roll>', snippet: '<em>Rock</em> &amp; Roll' },
  states: { raw: ['Utah', 'Nevada'] },
  quote: { raw: `"it's"` },
  plain: 'a <b>plain</b> value',
  empty: { raw: '' },
};

module('Unit | Helper | result field helpers', function () {
  test('htmlEscape escapes HTML special characters', function (assert) {
    assert.strictEqual(
      htmlEscape(`<a href="x">Tom & Jerry's</a>`),
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
    assert.strictEqual(htmlEscape(''), '');
    assert.strictEqual(htmlEscape(null), '');
    assert.strictEqual(htmlEscape(42), '42');
  });

  test('getFieldType reads a type from a field wrapper', function (assert) {
    assert.strictEqual(getFieldType(RESULT, 'title', 'raw'), 'Rock & <Roll>');
    assert.strictEqual(
      getFieldType(RESULT, 'title', 'snippet'),
      '<em>Rock</em> &amp; Roll',
    );
    assert.strictEqual(getFieldType(RESULT, 'missing', 'raw'), undefined);
  });

  test('getRaw / getSnippet return undefined when absent or empty', function (assert) {
    assert.strictEqual(getRaw(RESULT, 'title'), 'Rock & <Roll>');
    assert.strictEqual(getRaw(RESULT, 'empty'), undefined);
    assert.strictEqual(getRaw(RESULT, 'missing'), undefined);
    assert.strictEqual(getSnippet(RESULT, 'title'), '<em>Rock</em> &amp; Roll');
    assert.strictEqual(getSnippet(RESULT, 'states'), undefined);
  });

  test('getEscapedField prefers the snippet as-is', function (assert) {
    assert.strictEqual(
      getEscapedField(RESULT, 'title'),
      '<em>Rock</em> &amp; Roll',
    );
  });

  test('getEscapedField escapes raw values and joins arrays', function (assert) {
    assert.strictEqual(
      getEscapedField(RESULT, 'quote'),
      '&quot;it&#39;s&quot;',
    );
    assert.strictEqual(
      getEscapedField(RESULT, 'states'),
      'Utah,Nevada',
      'arrays are stringified before escaping',
    );
  });

  test('getEscapedField falls back to escaping a bare value', function (assert) {
    assert.strictEqual(
      getEscapedField(RESULT, 'plain'),
      'a &lt;b&gt;plain&lt;/b&gt; value',
    );
    assert.strictEqual(getEscapedField(RESULT, 'missing'), '');
  });

  test('isFieldValueWrapper detects raw/snippet wrappers', function (assert) {
    assert.ok(isFieldValueWrapper({ raw: 1 }));
    assert.ok(isFieldValueWrapper({ snippet: 'x' }));
    assert.notOk(isFieldValueWrapper({ score: 1 }));
    assert.notOk(isFieldValueWrapper('raw'));
    assert.notOk(isFieldValueWrapper(null));
  });
});
