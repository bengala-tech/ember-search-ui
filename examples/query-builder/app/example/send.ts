import type { SearchApiRequest, SearchApiSend } from 'ember-search-ui-driver';
import { fakeServer, type NetworkLog } from '../demo/fake-server.ts';
import config from 'query-builder/config/environment';

/**
 * The app's client: `(endpoint, request, options)`, here against the fake
 * server. In an app this is the fetch service, auth, the HTTP method...
 */
export function fakeSend(log: NetworkLog): SearchApiSend {
  return async (endpoint, request: SearchApiRequest, extra) => {
    if (endpoint.endsWith('.xlsx')) {
      // an export: the server would answer with a file
      log.add({
        endpoint,
        body: JSON.stringify(request),
        format: Array.isArray(request.filters) ? 'list' : 'groups',
        status: 'ok',
      });
      return { file: `${endpoint}`, rows: request.per, extra };
    }
    const search = fakeServer(log, {
      endpoint,
      latencyMs: config.environment === 'test' ? 0 : 150,
    });
    return search(
      request,
      (extra['signal'] as AbortSignal | undefined) ??
        new AbortController().signal,
    );
  };
}
