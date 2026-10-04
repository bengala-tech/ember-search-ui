import type { SearchResult } from '@elastic/search-ui';
import { getFieldType } from './get-field-type.ts';
import { htmlEscape } from './html-escape.ts';

export function getEscapedField(
  result: SearchResult,
  field: string | undefined,
): string {
  const safeField =
    getFieldType(result, field, 'snippet') ||
    htmlEscape(getFieldType(result, field, 'raw')) ||
    htmlEscape(result[field!]);
  return Array.isArray(safeField)
    ? safeField.join(', ')
    : (safeField as string);
}

export default getEscapedField;
