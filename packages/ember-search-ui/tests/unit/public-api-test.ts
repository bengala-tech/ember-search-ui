import { module, test } from 'qunit';
import * as api from '#src/index.ts';

module('Unit | public API', function () {
  test('the new-driver integration is exported from the package root', function (assert) {
    assert.strictEqual(typeof api.Search, 'function');
    assert.strictEqual(typeof api.TrackedSearch, 'function');
    assert.strictEqual(typeof api.trackSearch, 'function');
  });

  test('the property components are exported', function (assert) {
    for (const name of [
      'PropertyFilter',
      'PropertyChip',
      'LegacyFilterEditor',
      'LegacyFilterChip',
    ] as const) {
      assert.ok(api[name], name);
    }
  });

  test('the search-ui components are still exported', function (assert) {
    for (const name of [
      'SearchProvider',
      'WithSearch',
      'FacetContainer',
      'SearchBoxContainer',
    ] as const) {
      assert.ok(api[name], name);
    }
  });
});
