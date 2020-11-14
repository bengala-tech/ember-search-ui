import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { typeOf } from '@ember/utils';

export default class SearchBoxContainerComponent extends GlimmerComponent {
  @tracked isFocused;

	get shouldClearFilters() {
		return this.args.shouldClearFilters ?? true;
	}

  get inputProps() {
    return {
      onFocus: () => this.isFocused = true,
      onBlur: () => this.isFocused = false,
      ...(this.args.inputProps ?? {}),
    };
	}
	
  @action
  handleChange(setSearchTerm, e) {
		let value = "";
		if(typeOf(e) === 'string') {
			value = e;
		} else if(typeOf(e?.target?.value) === 'string') {
			value = e.target.value;
		}
		
    const {
      autocompleteMinimumCharacters,
      autocompleteResults,
      autocompleteSuggestions,
      searchAsYouType,
      debounceLength,
		} = this.args;

    const options = {
      autocompleteMinimumCharacters,
      ...((autocompleteResults ||
        autocompleteSuggestions ||
        searchAsYouType) && {
        debounce: debounceLength || 200,
      }),
      shouldClearFilters: this.shouldClearFilters,
      refresh: !!searchAsYouType,
      autocompleteResults: !!autocompleteResults,
      autocompleteSuggestions: !!autocompleteSuggestions,
    };

    setSearchTerm(value, options);
  }

  @action
  defaultOnSelectAutocomplete(selection) {
    if (!selection) return;

    const { autocompleteResults } = this.args;

    this.handleNotifyAutocompleteSelected(selection);
    if (!selection.suggestion) {
      const url = selection[autocompleteResults.urlField]
        ? selection[autocompleteResults.urlField].raw
        : '';
      if (url) {
        const target = autocompleteResults.linkTarget || '_self';
        window.open(url, target);
      }
    } else {
      this.completeSuggestion(selection.suggestion);
    }
  }

  @action
  handleSubmit(setSearchTerm, searchTerm, e) {
    const { onSubmit } = this.args;
    e.preventDefault();
    if (onSubmit) {
      onSubmit(setSearchTerm, searchTerm);
    }

    setSearchTerm(searchTerm, {
      shouldClearFilters: this.shouldClearFilters,
    });
  }

  @action
  completeSuggestion(setSearchTerm, searchTerm) {
    setSearchTerm(searchTerm, {
      shouldClearFilters: this.shouldClearFilters,
    });
  }

  @action
  handleNotifyAutocompleteSelected(trackAutocompleteClickThrough, selection) {
    const { autocompleteResults } = this.args;
    // Because suggestions don't count as clickthroughs, only
    // results
    if (
      autocompleteResults &&
      autocompleteResults.shouldTrackClickThrough !== false &&
      !selection.suggestion
    ) {
      const { clickThroughTags = [] } = autocompleteResults;
      const id = selection.id.raw;
      trackAutocompleteClickThrough(id, clickThroughTags);
    }
  }
}
