import { module, test } from 'qunit';
import { argOrDefault } from 'ember-search-ui/helpers/arg-or-default';
import { countAutocompletedSuggestions } from 'ember-search-ui/helpers/count-autocompleted-suggestions';
import { accentFold } from 'ember-search-ui/helpers/filter-facet-values';

module('Unit | Helper | misc helpers', function () {
  test('argOrDefault returns the value unless it is undefined', function (assert) {
    assert.strictEqual(argOrDefault(['value', 'default']), 'value');
    assert.strictEqual(argOrDefault([undefined, 'default']), 'default');
    assert.strictEqual(argOrDefault([null, 'default']), null, 'null is a real value');
    assert.false(argOrDefault([false, true]));
    assert.strictEqual(argOrDefault([0, 10]), 0);
  });

  test('argOrDefault requires a default value', function (assert) {
    assert.throws(() => argOrDefault(['value']), /`defaultValue` must be provided/);
  });

  test('countAutocompletedSuggestions sums suggestions across types', function (assert) {
    assert.strictEqual(countAutocompletedSuggestions({}), 0);
    assert.strictEqual(
      countAutocompletedSuggestions({ documents: [1, 2], popular_queries: [3] }),
      3
    );
  });

  test('accentFold strips diacritics', function (assert) {
    assert.strictEqual(accentFold('Montréal Ñandú'), 'Montreal Nandu');
    assert.strictEqual(accentFold(), '');
  });
});
