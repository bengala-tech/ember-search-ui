import { tracked } from '@glimmer/tracking';
import {
  OperatorRegistry,
  memoryBackend,
  searchApiCodec,
  sequentialIds,
  type SearchApiRequest,
  type SearchApiResponse,
} from 'ember-search-ui-driver';
import { FIELDS, INSPECTIONS, type Inspection } from './data.ts';

export interface Exchange {
  id: number;
  endpoint: string;
  /** Exactly what was sent, as JSON. */
  body: string;
  format: 'list' | 'groups';
  status: 'pending' | 'ok' | 'error' | 'aborted';
  total?: number;
  error?: string;
}

/** Every request the fake server received, newest first. */
export class NetworkLog {
  @tracked exchanges: Exchange[] = [];
  #next = 0;

  add(exchange: Omit<Exchange, 'id'>): Exchange {
    const entry = { ...exchange, id: ++this.#next };
    this.exchanges = [entry, ...this.exchanges].slice(0, 20);
    return entry;
  }

  update(entry: Exchange, patch: Partial<Exchange>) {
    this.exchanges = this.exchanges.map((e) =>
      e.id === entry.id ? { ...e, ...patch } : e,
    );
  }

  get last(): Exchange | undefined {
    return this.exchanges[0];
  }
}

const serverContext = {
  operators: new OperatorRegistry(),
  idFactory: sequentialIds('server-'),
  schema: FIELDS,
};

// The "server" decodes either filter format (like a real backend would)
// and searches with the same semantics the driver defines.
const decoder = searchApiCodec();
const search = memoryBackend<Inspection>(INSPECTIONS, {
  searchFields: ['title', 'description', 'project'],
});

/** Handles one request body as the search API would. */
export async function handle(
  body: string,
  signal: AbortSignal,
): Promise<SearchApiResponse> {
  const request = JSON.parse(body) as SearchApiRequest;
  const state = decoder.parse(request, serverContext);
  const { results, total } = await search.search(state, signal);
  const per = state.page.kind === 'offset' ? state.page.perPage : 20;
  return {
    data: results,
    meta: { total_count: total, total_pages: Math.ceil(total / per) },
  };
}

/**
 * A `request` function for searchApiBackend: serializes the request to JSON,
 * as the network would, and answers after `latencyMs`.
 */
export function fakeServer(
  log: NetworkLog,
  options: { latencyMs?: number; endpoint?: string } = {},
) {
  const endpoint = options.endpoint ?? 'api/inspections/search';
  return async (
    request: SearchApiRequest,
    signal: AbortSignal,
  ): Promise<SearchApiResponse> => {
    const body = JSON.stringify(request);
    const entry = log.add({
      endpoint,
      body,
      format: Array.isArray(request.filters) ? 'list' : 'groups',
      status: 'pending',
    });
    try {
      if (options.latencyMs) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, options.latencyMs);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason as Error);
          });
        });
      }
      const response = await handle(body, signal);
      log.update(entry, {
        status: 'ok',
        total: response.meta?.total_count ?? 0,
      });
      return response;
    } catch (error) {
      const aborted = signal.aborted;
      log.update(entry, {
        status: aborted ? 'aborted' : 'error',
        ...(aborted ? {} : { error: (error as Error).message }),
      });
      throw error;
    }
  };
}
