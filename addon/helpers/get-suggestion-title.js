import { helper } from '@ember/component/helper';

export function getSuggestionTitle(suggestionType, autocompleteSuggestions) {
  if (autocompleteSuggestions.sectionTitle) {
    return autocompleteSuggestions.sectionTitle;
  }

  if (
    autocompleteSuggestions[suggestionType] &&
    autocompleteSuggestions[suggestionType].sectionTitle
  ) {
    return autocompleteSuggestions[suggestionType].sectionTitle;
  }
}

export default helper(function (
  [suggestionType, autocompleteSuggestions] /*, hash*/
) {
  return getSnippet(suggestionType, autocompleteSuggestions);
});
