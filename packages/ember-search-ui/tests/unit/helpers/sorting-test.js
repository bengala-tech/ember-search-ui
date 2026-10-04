import { module, test } from 'qunit';
import { formatValue } from 'ember-search-ui/helpers/format-value';
import { findSortOption } from 'ember-search-ui/helpers/find-sort-option';
import { formatSelectOption } from 'ember-search-ui/helpers/format-select-option';

const SORT_OPTIONS = [
  { name: 'Relevance', value: '', direction: '' },
  { name: 'Title A-Z', value: 'title', direction: 'asc' },
  { name: 'Title Z-A', value: 'title', direction: 'desc' },
];

module('Unit | Helper | sorting helpers', function () {
  test('formatValue joins field and direction with the ||| separator', function (assert) {
    assert.strictEqual(formatValue('title', 'asc'), 'title|||asc');
    assert.strictEqual(formatValue('', ''), '|||');
  });

  test('findSortOption finds the option matching a formatted value', function (assert) {
    assert.deepEqual(findSortOption(SORT_OPTIONS, 'title|||desc'), SORT_OPTIONS[2]);
    assert.deepEqual(findSortOption(SORT_OPTIONS, '|||'), SORT_OPTIONS[0]);
    assert.strictEqual(findSortOption(SORT_OPTIONS, 'nope|||asc'), undefined);
  });

  test('formatSelectOption maps a sort option to a label/value pair', function (assert) {
    assert.deepEqual(formatSelectOption(SORT_OPTIONS[1]), {
      label: 'Title A-Z',
      value: 'title|||asc',
    });
  });

  test('formatSelectOption and findSortOption round-trip', function (assert) {
    for (let option of SORT_OPTIONS) {
      assert.deepEqual(findSortOption(SORT_OPTIONS, formatSelectOption(option).value), option);
    }
  });
});
