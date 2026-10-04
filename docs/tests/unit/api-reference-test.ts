import { module, test } from 'qunit';
import * as driver from 'ember-search-ui-driver';
import * as core from 'ember-search-ui';
import * as views from 'ember-search-ui-views';
import { API } from 'docs/api/reference';

const MODULES: Record<string, object> = {
  'ember-search-ui-driver': driver,
  'ember-search-ui': core,
  'ember-search-ui-views': views,
};

module('Unit | API reference', function () {
  for (const pkg of API) {
    test(`${pkg.name}: documents every export, and only exports`, function (assert) {
      const exported = Object.keys(MODULES[pkg.name]!).filter(
        (name) => name !== 'default',
      );
      const documented = pkg.sections
        .flatMap((section) => section.entries)
        .filter((entry) => entry.kind !== 'type')
        .map((entry) => entry.name);
      assert.deepEqual(
        exported.filter((name) => !documented.includes(name)).sort(),
        [],
        'exports missing from the reference',
      );
      assert.deepEqual(
        documented.filter((name) => !exported.includes(name)).sort(),
        [],
        'documented names that are not exported',
      );
      assert.strictEqual(
        new Set(documented).size,
        documented.length,
        'no name documented twice',
      );
    });
  }
});
