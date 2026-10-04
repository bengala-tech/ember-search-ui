import type { FacetValue } from '@elastic/search-ui';

export const accentFold = (str = ''): string =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function filterFacetValues<T extends Pick<FacetValue, 'value'>>(
  facetValues: T[] = [],
  searchTerm = '',
): T[] {
  if (searchTerm?.trim()) {
    const term = accentFold(searchTerm).toLowerCase();
    return facetValues.filter((option) =>
      accentFold(option.value as string)
        .toLowerCase()
        .includes(term),
    );
  }
  return facetValues;
}

export default filterFacetValues;
