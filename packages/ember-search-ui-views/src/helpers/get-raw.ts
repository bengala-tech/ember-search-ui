import type { SearchResult } from '@elastic/search-ui';

export function getRaw(
  result: SearchResult,
  value: string | undefined,
): unknown {
  const field = result[value!] as { raw?: unknown } | undefined;
  if (!field || !field.raw) return;
  return field.raw;
}

export default getRaw;
