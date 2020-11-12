import { helper } from '@ember/component/helper';

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
