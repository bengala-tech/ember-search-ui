import type { AutocompletedSuggestions } from '@elastic/search-ui';

export function countAutocompletedSuggestions(
  autocompletedSuggestions: AutocompletedSuggestions,
): number {
  return Object.values(autocompletedSuggestions).reduce(
    (acc, value) => acc + value.length,
    0,
  );
}

export default countAutocompletedSuggestions;
