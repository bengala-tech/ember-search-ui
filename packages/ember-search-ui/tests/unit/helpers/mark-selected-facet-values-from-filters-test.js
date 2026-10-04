import { module, test } from 'qunit';
import {
  doFilterValuesMatch,
  findFilterValues,
  markSelectedFacetValuesFromFilters,
} from 'ember-search-ui/helpers/mark-selected-facet-values-from-filters';

const FILTERS = [
  { field: 'states', type: 'any', values: ['California', 'Utah'] },
  { field: 'states', type: 'all', values: ['Maine'] },
  { field: 'acres', type: 'any', values: [{ name: 'Small', from: 0, to: 1000 }] },
];

module('Unit | Helper | mark-selected-facet-values-from-filters', function () {
  test('findFilterValues matches on field and filter type', function (assert) {
    assert.deepEqual(findFilterValues(FILTERS, 'states', 'any'), ['California', 'Utah']);
    assert.deepEqual(findFilterValues(FILTERS, 'states', 'all'), ['Maine']);
    assert.deepEqual(findFilterValues(FILTERS, 'states', 'none'), []);
    assert.deepEqual(findFilterValues(FILTERS, 'title', 'any'), []);
  });

  test('doFilterValuesMatch compares primitives strictly', function (assert) {
    assert.true(doFilterValuesMatch('a', 'a'));
    assert.false(doFilterValuesMatch('1', 1));
  });

  test('doFilterValuesMatch treats objects with the same name as equal', function (assert) {
    assert.true(doFilterValuesMatch({ name: 'Recent', from: 1 }, { name: 'Recent', from: 2 }));
  });

  test('doFilterValuesMatch deep-compares objects without names', function (assert) {
    assert.true(doFilterValuesMatch({ from: 0, to: 10 }, { from: 0, to: 10 }));
    assert.false(doFilterValuesMatch({ from: 0, to: 10 }, { from: 0, to: 11 }));
  });

  test('markSelectedFacetValuesFromFilters flags selected values without mutating input', function (assert) {
    let facet = {
      field: 'states',
      type: 'value',
      data: [
        { value: 'California', count: 2 },
        { value: 'Utah', count: 1 },
        { value: 'Maine', count: 1 },
      ],
    };
    let marked = markSelectedFacetValuesFromFilters(facet, FILTERS, 'states', 'any');

    assert.deepEqual(
      marked.data.map((v) => [v.value, v.selected]),
      [
        ['California', true],
        ['Utah', true],
        ['Maine', false],
      ]
    );
    assert.strictEqual(marked.field, 'states', 'keeps other facet keys');
    assert.strictEqual(facet.data[0].selected, undefined, 'does not mutate the facet');
  });

  test('markSelectedFacetValuesFromFilters handles range values', function (assert) {
    let facet = {
      data: [
        { value: { name: 'Small', from: 0, to: 1000 }, count: 3 },
        { value: { name: 'Large', from: 1001 }, count: 1 },
      ],
    };
    let marked = markSelectedFacetValuesFromFilters(facet, FILTERS, 'acres', 'any');
    assert.deepEqual(
      marked.data.map((v) => v.selected),
      [true, false]
    );
  });
});
