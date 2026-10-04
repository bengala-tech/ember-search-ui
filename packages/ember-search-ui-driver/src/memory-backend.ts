import type { Backend } from './codec.ts';
import { fieldValues, matches } from './evaluate.ts';
import type { OperatorRegistry } from './operators.ts';
import type { FieldPath, SearchState } from './types.ts';

export interface MemoryBackendOptions {
  /** Fields the full-text query searches; default: every string value. */
  searchFields?: FieldPath[];
  /** Reference time for date math; default Date.now() at each search. */
  now?: () => number;
  /** Simulated latency, to exercise loading states and cancellation. */
  latencyMs?: number;
  /** Needed only when the driver uses custom operators. */
  operators?: OperatorRegistry;
}

export interface MemoryResponse<Doc> {
  results: Doc[];
  total: number;
}

/**
 * Searches an array of documents in memory with the evaluator's semantics.
 * The request is the SearchState itself.
 */
export function memoryBackend<Doc>(
  docs: readonly Doc[] | (() => readonly Doc[]),
  options: MemoryBackendOptions = {},
): Backend<SearchState, MemoryResponse<Doc>, Doc> {
  return {
    codec: { serialize: (state: SearchState) => state },

    search: async (state: SearchState, signal: AbortSignal) => {
      if (options.latencyMs) await delay(options.latencyMs, signal);
      signal.throwIfAborted();

      const all = typeof docs === 'function' ? docs() : docs;
      const now = options.now?.() ?? Date.now();
      const term = state.query.term.trim().toLowerCase();
      const fields = state.query.fields ?? options.searchFields;

      let hits = all.filter(
        (doc) =>
          matches(state.filter, doc, {
            now,
            ...(options.operators ? { operators: options.operators } : {}),
          }) &&
          (term === '' || textOf(doc, fields).some((t) => t.includes(term))),
      );

      for (const { field, direction } of [...state.sort].reverse()) {
        const sign = direction === 'desc' ? -1 : 1;
        hits = [...hits].sort(
          (a, b) => sign * compareAny(first(a, field), first(b, field)),
        );
      }

      const total = hits.length;
      if (state.page.kind === 'offset') {
        const start = (state.page.page - 1) * state.page.perPage;
        hits = hits.slice(start, start + state.page.perPage);
      } else {
        const start = state.page.cursor ? Number(state.page.cursor) : 0;
        hits = hits.slice(start, start + state.page.size);
      }
      return { results: hits, total };
    },

    normalize: (response: MemoryResponse<Doc>) => response,
  };
}

function first(doc: unknown, field: FieldPath): unknown {
  return fieldValues(doc, field)[0];
}

function compareAny(a: unknown, b: unknown): number {
  if (a === undefined) return b === undefined ? 0 : 1; // missing values last
  if (b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  // sort keys are leaf values (strings, booleans, dates as strings)
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(a).localeCompare(String(b));
}

function textOf(
  doc: unknown,
  fields: readonly FieldPath[] | undefined,
): string[] {
  const values = fields
    ? fields.flatMap((field) => fieldValues(doc, field))
    : allLeaves(doc);
  return values
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.toLowerCase());
}

function allLeaves(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(allLeaves);
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(allLeaves);
  }
  return [value];
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason as Error);
      },
      { once: true },
    );
  });
}
