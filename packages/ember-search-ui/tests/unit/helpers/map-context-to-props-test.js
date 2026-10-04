import { module, test } from 'qunit';
import { mapContextToProps } from 'ember-search-ui/helpers/map-context-to-props';

module('Unit | Helper | map-context-to-props', function () {
  test('it plucks only the requested keys', function (assert) {
    let pick = mapContextToProps(['searchTerm', 'current']);
    assert.deepEqual(pick({ searchTerm: 'zion', current: 2, results: [] }), {
      searchTerm: 'zion',
      current: 2,
    });
  });

  test('it skips keys missing from the context but keeps falsy values', function (assert) {
    let pick = mapContextToProps(['error', 'missing']);
    assert.deepEqual(pick({ error: '' }), { error: '' });
  });

  test('it ignores inherited properties', function (assert) {
    let context = Object.create({ inherited: true });
    context.own = 1;
    assert.deepEqual(mapContextToProps(['inherited', 'own'])(context), { own: 1 });
  });

  test('it defaults to an empty selection', function (assert) {
    assert.deepEqual(mapContextToProps()({ a: 1 }), {});
  });
});
