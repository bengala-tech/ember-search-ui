import type { SearchResult } from '@elastic/search-ui';

export function getFieldType(
  result: SearchResult,
  field: string | undefined,
  type: 'raw' | 'snippet',
): unknown {
  const value = result[field!] as Record<string, unknown> | undefined;
  if (value) return value[type];
}

export default getFieldType;
