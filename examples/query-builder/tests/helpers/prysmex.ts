import { find } from '@ember/test-helpers';
import { INSPECTIONS, type Inspection } from 'query-builder/demo/data';
import { handle } from 'query-builder/demo/fake-prysmex';

/** The JSON shown in a panel, parsed. */
export function panelJson(selector: string): Record<string, unknown> {
  const text = find(selector)?.textContent;
  if (!text) throw new Error(`No JSON in ${selector}`);
  return JSON.parse(text) as Record<string, unknown>;
}

/** How many inspections satisfy `predicate`, straight from the raw data. */
export const truth = (predicate: (d: Inspection) => boolean) =>
  INSPECTIONS.filter(predicate).length;

/** Sends a request body to the fake Prysmex server and returns its total. */
export async function totalFor(request: unknown): Promise<number> {
  const response = await handle(
    JSON.stringify(request),
    new AbortController().signal,
  );
  return response.meta?.total_count ?? -1;
}
