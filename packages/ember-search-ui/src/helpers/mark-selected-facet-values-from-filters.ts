import deepEqual from 'deep-equal';
import type {
  Facet,
  FacetValue,
  Filter,
  FilterType,
  FilterValue,
} from '@elastic/search-ui';

/**
 * Given a list of applied Filters, find FilterValues based on
 * "fieldName" and "filterType".
 */
export function findFilterValues(
  filters: Filter[],
  name: string,
  filterType: FilterType,
): FilterValue[] {
  const filter = filters.find((f) => f.field === name && f.type === filterType);
  if (!filter) return [];
  return filter.values;
}

const hasName = (value: unknown): value is { name: string } =>
  !!value && !!(value as { name?: unknown }).name;

/**
 * Useful for determining when filter values match. This could be used
 * when matching applied filters back to facet options, or for determining
 * whether or not a filter already exists in a list of applied filters.
 */
export function doFilterValuesMatch(
  filterValue1: unknown,
  filterValue2: unknown,
): boolean {
  if (
    hasName(filterValue1) &&
    hasName(filterValue2) &&
    filterValue1.name === filterValue2.name
  )
    // If two filters have matching names, then they are the same filter, there
    // is no need to do a more expensive deep equal comparison.
    //
    // This is also important because certain filters and facets will have
    // differing values than their corresponding facet options. For instance,
    // consider a time-based facet like "Last 10 Minutes". The value of the
    // filter will be different depending on when it was selected, but the name
    // will always match.
    return true;
  // We use 'strict = true' to do a '===' of leaves, rather than '=='
  return deepEqual(filterValue1, filterValue2, { strict: true });
}

export type SelectableFacet = Omit<Facet, 'data'> & {
  data: Required<FacetValue>[];
};

/**
 * Given a Facet and a list of applied Filters, mark the Facet Values
 * for that Facet as "selected" based on "fieldName" and "filterType".
 */
export function markSelectedFacetValuesFromFilters(
  facet: Pick<Facet, 'data'> & Partial<Facet>,
  filters: Filter[],
  fieldName: string,
  filterType: FilterType,
): SelectableFacet {
  const facetValues = facet.data;
  const filterValuesForField =
    findFilterValues(filters, fieldName, filterType) || [];
  return {
    ...facet,
    data: facetValues.map((facetValue) => {
      return {
        ...facetValue,
        selected: filterValuesForField.some((filterValue) => {
          return doFilterValuesMatch(filterValue, facetValue.value);
        }),
      };
    }),
  } as SelectableFacet;
}

export default markSelectedFacetValuesFromFilters;
