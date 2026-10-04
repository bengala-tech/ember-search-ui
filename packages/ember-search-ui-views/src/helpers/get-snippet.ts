import type { SearchResult } from '@elastic/search-ui';

export function getSnippet(
  result: SearchResult,
  value: string | undefined,
): unknown {
  const field = result[value!] as { snippet?: unknown } | undefined;
  if (!field || !field.snippet) return;
  return field.snippet;
}

export default getSnippet;
