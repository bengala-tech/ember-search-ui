import { registerDestructor } from '@ember/destroyable';
import {
  browserHistory,
  memoryHistory,
  syncUrl,
  urlCodec,
  type SearchDriver,
  type UrlAdapter,
  type UrlCodec,
  type UrlSyncOptions,
} from 'ember-search-ui-driver';
import config from 'docs/config/environment';

// Every demo keeps its search in the URL under its own prefix, so a filter
// (a preset, or one built by hand) can be shared as a link.

/** Tests set the starting URL here (the app uses the real one). */
export const TEST_URL = { value: '' };

interface Shared {
  codec: UrlCodec;
  adapter: UrlAdapter;
}

const SHARED = new WeakMap<object, Shared>();

/**
 * syncUrl options for `driver` under `prefix`, remembered for shareLink.
 * Pass them to syncUrl or <Search @syncUrl>.
 */
export function shareable(
  driver: SearchDriver<never> | SearchDriver<unknown>,
  prefix: string,
  options: UrlSyncOptions = {},
): UrlSyncOptions {
  const test = config.environment === 'test';
  // tests must not rewrite the test runner's URL
  const adapter = test ? memoryHistory(TEST_URL.value) : browserHistory();
  const codec = urlCodec({ prefix, defaults: driver.state });
  SHARED.set(driver, { codec, adapter });
  return { debounceMs: test ? 0 : 250, ...options, adapter, codec };
}

/** Starts URL sync for `driver` until `owner` is destroyed. */
export function share(
  owner: object,
  driver: SearchDriver<never> | SearchDriver<unknown>,
  prefix: string,
): void {
  // a guide page has several demos: rewrite the entry, do not stack history
  const stop = syncUrl(
    driver,
    shareable(driver, prefix, { history: 'replace' }),
  );
  registerDestructor(owner, stop);
}

/** A link to this page with `driver`'s current search, if it is shared. */
export function shareLink(
  driver: SearchDriver<never> | SearchDriver<unknown>,
): string | undefined {
  const shared = SHARED.get(driver);
  if (!shared) return undefined;
  const { codec, adapter } = shared;
  const params = new URLSearchParams(adapter.read());
  for (const key of [...params.keys()]) if (codec.owns(key)) params.delete(key);
  new URLSearchParams(codec.serialize(driver.state)).forEach((value, key) =>
    params.append(key, value),
  );
  const search = params.toString();
  const { origin, pathname, hash } = window.location;
  return `${origin}${pathname}${search ? `?${search}` : ''}${hash}`;
}
