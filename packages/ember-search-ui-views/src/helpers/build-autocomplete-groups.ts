import type {
  AutocompleteResult,
  AutocompletedResult,
  AutocompletedSuggestion,
  AutocompletedSuggestions,
  SearchResult,
} from '@elastic/search-ui';
import { getRaw } from './get-raw.ts';
import { getSnippet } from './get-snippet.ts';
import { getSuggestionTitle } from './get-suggestion-title.ts';

export interface AutocompleteGroup {
  groupName: string | undefined;
  options: unknown[];
  class: string;
  getText: (option: never) => unknown;
  isSuggestionGroup: boolean;
}

const createGroup = (
  name: string | undefined,
  options: unknown[] | undefined,
  className: string,
  getText: AutocompleteGroup['getText'],
  isSuggestionGroup = false,
): AutocompleteGroup => ({
  groupName: name,
  options: options as unknown[],
  class: className,
  getText,
  isSuggestionGroup: isSuggestionGroup,
});

function getTextForResult(
  titleField: string | undefined,
  result: SearchResult,
) {
  const titleSnippet = getSnippet(result, titleField);
  const titleRaw = getRaw(result, titleField);
  return titleSnippet ? titleSnippet : titleRaw;
}

function getTextForSuggestion(result: AutocompletedSuggestion | undefined) {
  return result?.highlight ? result?.highlight : result?.suggestion;
}

export interface BuildAutocompleteGroupsOptions {
  /** `true` (or omitted) means "no extra configuration". */
  autocompleteSuggestions?: boolean | object;
  autocompletedSuggestions?: AutocompletedSuggestions;
  autocompletedResults?: AutocompletedResult[];
  autocompleteResults?: boolean | Partial<AutocompleteResult>;
}

const asConfig = <T extends object>(value: boolean | T): Partial<T> =>
  typeof value === 'object' ? value : {};

export function buildAutocompleteGroups({
  autocompleteSuggestions = {},
  autocompletedSuggestions = {},
  autocompletedResults = [],
  autocompleteResults = {},
}: BuildAutocompleteGroupsOptions = {}): AutocompleteGroup[] {
  const suggestionsConfig = asConfig(autocompleteSuggestions) as Record<
    string,
    unknown
  >;
  const resultsConfig = asConfig(autocompleteResults);
  const groups: AutocompleteGroup[] = [];
  const suggestionsKeys = Object.keys(autocompletedSuggestions);
  suggestionsKeys.forEach((suggestionType) => {
    groups.push(
      createGroup(
        getSuggestionTitle(suggestionType, suggestionsConfig),
        autocompletedSuggestions[suggestionType],
        'sui-search-box__suggestion-list',
        getTextForSuggestion,
        true,
      ),
    );
  });
  groups.push(
    createGroup(
      resultsConfig.sectionTitle,
      autocompletedResults,
      'sui-search-box__result-list',
      getTextForResult.bind(null, resultsConfig.titleField),
    ),
  );
  return groups;
}

export default buildAutocompleteGroups;
