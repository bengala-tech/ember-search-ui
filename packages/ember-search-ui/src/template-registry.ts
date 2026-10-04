// Lets apps that still use loose-mode (.hbs) templates get Glint types for
// this addon's components and helpers:
//
//   import type EmberSearchUiRegistry from 'ember-search-ui/template-registry';
//   declare module '@glint/environment-ember-loose/registry' {
//     export default interface Registry extends EmberSearchUiRegistry {}
//   }
import type SearchProvider from './components/search-provider.gts';
import type WithSearch from './components/with-search.gts';
import type ErrorBoundaryContainer from './components/containers/error-boundary.gts';
import type FacetContainer from './components/containers/facet.gts';
import type PagingContainer from './components/containers/paging.gts';
import type PagingInfoContainer from './components/containers/paging-info.gts';
import type ResultContainer from './components/containers/result.gts';
import type ResultsContainer from './components/containers/results.gts';
import type ResultsPerPageContainer from './components/containers/results-per-page.gts';
import type SearchBoxContainer from './components/containers/search-box.gts';
import type SortingContainer from './components/containers/sorting.gts';
import type argOrDefault from './helpers/arg-or-default.ts';
import type bool from './helpers/bool.ts';
import type countAutocompletedSuggestions from './helpers/count-autocompleted-suggestions.ts';
import type filterFacetValues from './helpers/filter-facet-values.ts';
import type findSortOption from './helpers/find-sort-option.ts';
import type formatSelectOption from './helpers/format-select-option.ts';
import type formatValue from './helpers/format-value.ts';
import type mapContextToProps from './helpers/map-context-to-props.ts';
import type markSelectedFacetValuesFromFilters from './helpers/mark-selected-facet-values-from-filters.ts';

export default interface Registry {
  SearchProvider: typeof SearchProvider;
  WithSearch: typeof WithSearch;
  'Containers::ErrorBoundary': typeof ErrorBoundaryContainer;
  'Containers::Facet': typeof FacetContainer;
  'Containers::Paging': typeof PagingContainer;
  'Containers::PagingInfo': typeof PagingInfoContainer;
  'Containers::Result': typeof ResultContainer;
  'Containers::Results': typeof ResultsContainer;
  'Containers::ResultsPerPage': typeof ResultsPerPageContainer;
  'Containers::SearchBox': typeof SearchBoxContainer;
  'Containers::Sorting': typeof SortingContainer;
  'arg-or-default': typeof argOrDefault;
  bool: typeof bool;
  'count-autocompleted-suggestions': typeof countAutocompletedSuggestions;
  'filter-facet-values': typeof filterFacetValues;
  'find-sort-option': typeof findSortOption;
  'format-select-option': typeof formatSelectOption;
  'format-value': typeof formatValue;
  'map-context-to-props': typeof mapContextToProps;
  'mark-selected-facet-values-from-filters': typeof markSelectedFacetValuesFromFilters;
}
