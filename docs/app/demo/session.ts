import {
  SearchDriver,
  memoryHistory,
  searchApiBackend,
  searchApiCodec,
  searchUiCompat,
  type SearchUiCompat,
  type UrlSyncOptions,
} from 'ember-search-ui-driver';
import config from 'docs/config/environment';
import { FIELDS, type Inspection } from './data.ts';
import { NetworkLog, fakeServer } from './fake-server.ts';

export type Format = 'list' | 'groups';

export const FORMAT_LABELS: Record<Format, string> = {
  list: 'legacy list',
  groups: 'groups spec',
};

/**
 * One search page: a driver whose backend sends search API requests in one
 * filter format to the fake server, plus the search-ui compat API on top.
 * The internal state is the same SearchState either way.
 */
export class DemoSession {
  readonly log = new NetworkLog();
  readonly driver: SearchDriver<Inspection>;
  readonly compat: SearchUiCompat<Inspection>;
  readonly format: Format;
  readonly urlSync: UrlSyncOptions;

  constructor(format: Format, prefix: string) {
    this.format = format;
    this.driver = new SearchDriver<Inspection>({
      backend: searchApiBackend<Inspection>({
        filters: format,
        request: fakeServer(this.log, {
          latencyMs: config.environment === 'test' ? 0 : 150,
        }),
      }),
      schema: FIELDS,
      initialState: {
        page: { kind: 'offset', page: 1, perPage: 8 },
        sort: [{ field: 'created_at', direction: 'desc' }],
      },
    });
    this.compat = searchUiCompat(this.driver);
    this.urlSync = {
      prefix,
      debounceMs: config.environment === 'test' ? 0 : 250,
      // tests must not rewrite the test runner's URL
      ...(config.environment === 'test'
        ? { adapter: memoryHistory(TEST_URL.value) }
        : {}),
    };
  }

  /** The same internal state serialized in the other format. */
  otherFormat():
    | { format: Format; ok: true; request: unknown }
    | { format: Format; ok: false; reason: string; nodeId: string } {
    const format: Format = this.format === 'list' ? 'groups' : 'list';
    const codec = searchApiCodec({ filters: format });
    const support = codec.supports(
      this.driver.state.filter,
      this.driver.codecContext,
    );
    if (!support.ok) return { format, ...support };
    return {
      format,
      ok: true,
      request: codec.serialize(this.driver.state, this.driver.codecContext),
    };
  }

  destroy() {
    this.compat.tearDown();
  }
}

/** Tests set the starting URL here (the app uses the real one). */
export const TEST_URL = { value: '' };
