import { helper } from "@ember/component/helper";
import { getRaw } from './get-raw';
import { getSnippet } from './get-snippet';
import { getSuggestionTitle } from './get-suggestion-title';

const createGroup = (name, options, className, getText, isSuggestionGroup = false) => ({
  groupName: name,
  options,
	class: className,
	getText,
  isSuggestionGroup: isSuggestionGroup,
});

function getTextForResult(titleField, result) {
  let titleSnippet = getSnippet(result, titleField);
  let titleRaw = getRaw(result, titleField);
  return titleSnippet ? titleSnippet : titleRaw;
}

function getTextForSuggestion(result) {
  return result?.highlight ? result?.highlight : result?.suggestion;
}

export default helper(function (
  _positional,
  {
    autocompleteSuggestions = {},
    autocompletedSuggestions = {},
    autocompletedResults = [],
    autocompleteResults = {},
  }
) {
  let groups = [];
  let suggestionsKeys = Object.keys(autocompletedSuggestions);
  suggestionsKeys.forEach((suggestionType) => {
    groups.push(
      createGroup(
        getSuggestionTitle(suggestionType, autocompleteSuggestions),
        autocompletedSuggestions[suggestionType],
        "sui-search-box__suggestion-list",
        getTextForSuggestion,
        true
      )
    );
	});
  groups.push(
    createGroup(
      autocompleteResults.sectionTitle,
      autocompletedResults,
      "sui-search-box__result-list",
      getTextForResult.bind(null, autocompleteResults.titleField)
    )
	);
  return groups;
});
