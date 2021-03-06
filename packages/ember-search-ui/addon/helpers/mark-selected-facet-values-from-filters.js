import { helper } from '@ember/component/helper';
import deepEqual from 'deep-equal';

/**
 * Given a list of applied Filters, find FilterValues based on
 * "fieldName" and "filterType".
 *
 * @param {*} filters
 * @param {*} name
 * @param {*} filterType
 */
export function findFilterValues(filters, name, filterType) {
  const filter = filters.find((f) => f.field === name && f.type === filterType);
  if (!filter) return [];
  return filter.values;
}

/**
 * Useful for determining when filter values match. This could be used
 * when matching applied filters back to facet options, or for determining
 * whether or not a filter already exists in a list of applied filters.
 *
 * @param {FilterValue} filterValue1
 * @param {FilterValue} filterValue2
 */
export function doFilterValuesMatch(filterValue1, filterValue2) {
  if (
    filterValue1 &&
    filterValue1.name &&
    filterValue2 &&
    filterValue2.name &&
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

/**
 * Given a Facet and a list of applied Filters, mark the Facet Values
 * for that Facet as "selected" based on "fieldName" and "filterType".
 *
 * @param {Facet} facet
 * @param {String} fieldName
 * @param {Filter[]} filters
 * @param {FilterType} filterType
 */
export function markSelectedFacetValuesFromFilters(
  facet,
  filters,
  fieldName,
  filterType
) {
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
  };
}

export default helper(function (
  [facet, filters, field, filterType] /*, hash*/
) {
  return markSelectedFacetValuesFromFilters(facet, filters, field, filterType);
});
