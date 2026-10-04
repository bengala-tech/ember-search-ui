// Lets apps that still use loose-mode (.hbs) templates get Glint types for
// this addon's components and helpers:
//
//   import type ViewsRegistry from 'ember-search-ui-views/template-registry';
//   declare module '@glint/environment-ember-loose/registry' {
//     export default interface Registry extends ViewsRegistry {}
//   }
import type AutocompleteInput from './components/autocomplete-input.gts';
import type AutocompleteInputInput from './components/autocomplete-input/input.gts';
import type AutocompleteInputItems from './components/autocomplete-input/items.gts';
import type BooleanFacet from './components/boolean-facet.gts';
import type ErrorBoundary from './components/error-boundary.gts';
import type Facet from './components/facet.gts';
import type Facets from './components/facets.gts';
import type Layout from './components/layout.gts';
import type LayoutSidebar from './components/layout-sidebar.gts';
import type MultiCheckboxFacet from './components/multi-checkbox-facet.gts';
import type Paging from './components/paging.gts';
import type PagingInfo from './components/paging-info.gts';
import type Result from './components/result.gts';
import type Results from './components/results.gts';
import type ResultsPerPage from './components/results-per-page.gts';
import type SearchBox from './components/search-box.gts';
import type SingleLinksFacet from './components/single-links-facet.gts';
import type SingleSelectFacet from './components/single-select-facet.gts';
import type Sorting from './components/sorting.gts';
import type Trigger from './components/trigger.gts';
import type buildAutocompleteGroups from './helpers/build-autocomplete-groups.ts';
import type getEscapedField from './helpers/get-escaped-field.ts';
import type getEscapedFields from './helpers/get-escaped-fields.ts';
import type getFieldType from './helpers/get-field-type.ts';
import type getFilterValueDisplay from './helpers/get-filter-value-display.ts';
import type getRaw from './helpers/get-raw.ts';
import type getSnippet from './helpers/get-snippet.ts';
import type getSuggestionTitle from './helpers/get-suggestion-title.ts';
import type getUrlSanitizer from './helpers/get-url-sanitizer.ts';
import type htmlEscape from './helpers/html-escape.ts';
import type isFieldValueWrapper from './helpers/is-field-value-wrapper.ts';
import type mapFacetOptions from './helpers/map-facet-options.ts';
import type pickValue from './helpers/pick-value.ts';
import type toLocaleString from './helpers/to-locale-string.ts';
import type wrapOptions from './helpers/wrap-options.ts';

export default interface Registry {
  AutocompleteInput: typeof AutocompleteInput;
  'AutocompleteInput::Input': typeof AutocompleteInputInput;
  'AutocompleteInput::Items': typeof AutocompleteInputItems;
  BooleanFacet: typeof BooleanFacet;
  ErrorBoundary: typeof ErrorBoundary;
  Facet: typeof Facet;
  Facets: typeof Facets;
  Layout: typeof Layout;
  LayoutSidebar: typeof LayoutSidebar;
  MultiCheckboxFacet: typeof MultiCheckboxFacet;
  Paging: typeof Paging;
  PagingInfo: typeof PagingInfo;
  Result: typeof Result;
  Results: typeof Results;
  ResultsPerPage: typeof ResultsPerPage;
  SearchBox: typeof SearchBox;
  SingleLinksFacet: typeof SingleLinksFacet;
  SingleSelectFacet: typeof SingleSelectFacet;
  Sorting: typeof Sorting;
  Trigger: typeof Trigger;
  'build-autocomplete-groups': typeof buildAutocompleteGroups;
  'field-value-wrapper': typeof isFieldValueWrapper;
  'get-escaped-field': typeof getEscapedField;
  'get-escaped-fields': typeof getEscapedFields;
  'get-field-type': typeof getFieldType;
  'get-filter-value-display': typeof getFilterValueDisplay;
  'get-raw': typeof getRaw;
  'get-snippet': typeof getSnippet;
  'get-suggestion-title': typeof getSuggestionTitle;
  'get-url-sanitizer': typeof getUrlSanitizer;
  'html-escape': typeof htmlEscape;
  'is-field-value-wrapper': typeof isFieldValueWrapper;
  'map-facet-options': typeof mapFacetOptions;
  'pick-value': typeof pickValue;
  'to-locale-string': typeof toLocaleString;
  'wrap-options': typeof wrapOptions;
}
