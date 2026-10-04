// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import {
  SearchDriver,
  browserHistory,
  eq,
  memoryBackend,
  syncUrl,
} from '../src/index.ts';
import { XUT_DOCS } from './fixtures.ts';

afterEach(() => window.history.replaceState(null, '', '/'));

test('browserHistory keeps path and hash, and follows popstate', async () => {
  window.history.replaceState(null, '', '/parks?tab=map#top');
  const driver = new SearchDriver({ backend: memoryBackend(XUT_DOCS) });
  const stop = syncUrl(driver, { adapter: browserHistory(), debounceMs: 0 });

  driver.add('root', eq('x', 'b'));
  await new Promise((r) => setTimeout(r, 0));
  expect(window.location.pathname).toBe('/parks');
  expect(window.location.hash).toBe('#top');
  expect(new URLSearchParams(window.location.search).get('tab')).toBe('map');
  expect(new URLSearchParams(window.location.search).has('f')).toBe(true);

  window.history.replaceState(null, '', '/parks?q=zion');
  window.dispatchEvent(new PopStateEvent('popstate'));
  expect(driver.state.query.term).toBe('zion');
  expect(driver.state.filter.children).toHaveLength(0);

  stop();
  driver.destroy();
});
