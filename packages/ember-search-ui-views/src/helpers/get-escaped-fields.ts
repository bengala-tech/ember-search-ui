import type { SearchResult } from '@elastic/search-ui';
import { getEscapedField } from './get-escaped-field.ts';
import { isFieldValueWrapper } from './is-field-value-wrapper.ts';

export function getEscapedFields(result: SearchResult): Record<string, string> {
  return Object.keys(result).reduce((acc, field) => {
    // If we receive an arbitrary value from the response, we may not properly
    // handle it, so we should filter out arbitrary values here.
    //
    // I.e.,
    // Arbitrary value: "_metaField: '1939191'"
    // vs.
    // FieldValueWrapper: "_metaField: {raw: '1939191'}"
    if (!isFieldValueWrapper(result[field])) return acc;
    return { ...acc, [field]: getEscapedField(result, field) };
  }, {});
}

export default getEscapedFields;
