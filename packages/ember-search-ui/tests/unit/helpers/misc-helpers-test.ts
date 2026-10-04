import { module, test } from 'qunit';
import { argOrDefault } from '#src/helpers/arg-or-default.ts';
import { countAutocompletedSuggestions } from '#src/helpers/count-autocompleted-suggestions.ts';
import { accentFold } from '#src/helpers/filter-facet-values.ts';

module('Unit | Helper | misc helpers', function () {
  test('argOrDefault returns the value unless it is undefined', function (assert) {
    assert.strictEqual(argOrDefault(['value', 'default']), 'value');
    assert.strictEqual(argOrDefault([undefined, 'default']), 'default');
    assert.strictEqual(
      argOrDefault([null, 'default']),
      null,
      'null is a real value',
    );
    assert.false(argOrDefault([false, true]));
    assert.strictEqual(argOrDefault([0, 10]), 0);
  });

  test('argOrDefault requires a default value', function (assert) {
    assert.throws(
      // @ts-expect-error -- deliberately omitting the default
      () => argOrDefault(['value']),
      /`defaultValue` must be provided/,
    );
  });

  test('countAutocompletedSuggestions sums suggestions across types', function (assert) {
    assert.strictEqual(countAutocompletedSuggestions({}), 0);
    assert.strictEqual(
      countAutocompletedSuggestions({
        documents: [{}, {}],
        popular_queries: [{}],
      }),
      3,
    );
  });

  test('accentFold strips diacritics', function (assert) {
    assert.strictEqual(accentFold('Montréal Ñandú'), 'Montreal Nandu');
    assert.strictEqual(accentFold(), '');
  });
});
