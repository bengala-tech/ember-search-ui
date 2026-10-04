import { module, test } from 'qunit';
import { SearchDriver } from '@elastic/search-ui';
import { setupDriver } from '#src/components/search-provider.gts';
import { buildConfig, createDriver } from '../helpers/search.ts';

module('Unit | search-provider | setupDriver', function () {
  test('it returns the given driver untouched', function (assert) {
    const driver = createDriver({ alwaysSearchOnInitialLoad: false });
    assert.strictEqual(setupDriver({}, driver), driver);
    driver.tearDown();
  });

  test('it builds a SearchDriver from config with default a11y messages', function (assert) {
    const driver = setupDriver(
      buildConfig({ alwaysSearchOnInitialLoad: false }),
    )!;
    assert.ok(driver instanceof SearchDriver);
    const moreFilters = driver.a11yNotificationMessages['moreFilters']!;
    assert.strictEqual(
      moreFilters({ visibleOptionsCount: 15, showingAll: false }),
      '15 options shown.',
    );
    assert.strictEqual(
      moreFilters({ visibleOptionsCount: 7, showingAll: true }),
      'All 7 options shown.',
    );
    driver.tearDown();
  });

  test('custom a11y messages override the defaults', function (assert) {
    const driver = setupDriver(
      buildConfig({
        alwaysSearchOnInitialLoad: false,
        a11yNotificationMessages: { moreFilters: () => 'custom' },
      }),
    )!;
    assert.strictEqual(
      driver.a11yNotificationMessages['moreFilters']!({}),
      'custom',
    );
    driver.tearDown();
  });
});
