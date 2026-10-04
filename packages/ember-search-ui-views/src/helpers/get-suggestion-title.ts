type SuggestionsConfig = Record<string, unknown> & { sectionTitle?: string };

export function getSuggestionTitle(
  suggestionType: string,
  autocompleteSuggestions: SuggestionsConfig,
): string | undefined {
  if (autocompleteSuggestions.sectionTitle) {
    return autocompleteSuggestions.sectionTitle;
  }

  const typeConfig = autocompleteSuggestions[suggestionType] as
    { sectionTitle?: string } | undefined;
  if (typeConfig && typeConfig.sectionTitle) {
    return typeConfig.sectionTitle;
  }
}

export default getSuggestionTitle;
