// New driver (ember-search-ui-driver) integration
export { default as Search } from './components/search.gts';
export { TrackedSearch, trackSearch } from './tracked-search.ts';
export type { SearchSignature, SearchConfig } from './components/search.gts';

// @elastic/search-ui based components
export {
  default as SearchProvider,
  setupDriver,
} from './components/search-provider.gts';
export { default as WithSearch } from './components/with-search.gts';
export { default as ErrorBoundaryContainer } from './components/containers/error-boundary.gts';
export { default as FacetContainer } from './components/containers/facet.gts';
export { default as PagingContainer } from './components/containers/paging.gts';
export { default as PagingInfoContainer } from './components/containers/paging-info.gts';
export { default as ResultContainer } from './components/containers/result.gts';
export { default as ResultsContainer } from './components/containers/results.gts';
export { default as ResultsPerPageContainer } from './components/containers/results-per-page.gts';
export { default as SearchBoxContainer } from './components/containers/search-box.gts';
export { default as SortingContainer } from './components/containers/sorting.gts';

export { default as mapContextToProps } from './helpers/map-context-to-props.ts';
export { resolveComponent, type ViewArg } from './utils/resolve-component.ts';

export type * from './types.ts';
export type { SearchProviderSignature } from './components/search-provider.gts';
export type { WithSearchSignature } from './components/with-search.gts';
export type * from './components/containers/error-boundary.gts';
export type * from './components/containers/facet.gts';
export type * from './components/containers/paging.gts';
export type * from './components/containers/paging-info.gts';
export type * from './components/containers/result.gts';
export type * from './components/containers/results.gts';
export type * from './components/containers/results-per-page.gts';
export type * from './components/containers/search-box.gts';
export type * from './components/containers/sorting.gts';

// Properties: filter editors and chips, legacy components included
export { default as PropertyFilter } from './components/properties/property-filter.gts';
export { default as PropertyChip } from './components/properties/property-chip.gts';
export { default as LegacyFilterEditor } from './components/properties/legacy-filter-editor.gts';
export { default as LegacyFilterChip } from './components/properties/legacy-filter-chip.gts';
export type * from './properties.ts';
export type { PropertyFilterSignature } from './components/properties/property-filter.gts';
export type { PropertyChipSignature } from './components/properties/property-chip.gts';
export type {
  LegacyFilterEditorSignature,
  LegacyFilterComponentArgs,
} from './components/properties/legacy-filter-editor.gts';
export type { LegacyListValuesArgs } from './components/properties/legacy-filter-chip.gts';
