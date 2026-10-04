import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn, hash } from '@ember/helper';
import type {
  AutocompleteResult,
  AutocompleteSuggestion,
  AutocompletedResult,
  AutocompletedSuggestions,
  SearchDriver,
  SearchDriverActions,
} from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps, {
  type MappedContext,
} from '../../helpers/map-context-to-props.ts';
import { countAutocompletedSuggestions } from '../../helpers/count-autocompleted-suggestions.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

type SetSearchTerm = SearchDriverActions['setSearchTerm'];
type TrackAutocompleteClickThrough =
  SearchDriverActions['trackAutocompleteClickThrough'];

export interface InputProps {
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  class?: string;
  [key: string]: unknown;
}

/** A selected autocomplete item: a result, or `{ suggestion }`. */
export type AutocompleteSelection = Record<string, unknown> & {
  suggestion?: string;
};

/** Second argument to `@onSelectAutocomplete`, as in @elastic/react-search-ui. */
export interface OnSelectAutocompleteHelpers {
  setSearchTerm: SetSearchTerm;
  autocompleteResults: boolean | Partial<AutocompleteResult> | undefined;
  autocompleteSuggestions: boolean | AutocompleteSuggestion | undefined;
}

export type OnSelectAutocomplete = (
  selection: AutocompleteSelection,
  helpers: OnSelectAutocompleteHelpers,
  defaultOnSelectAutocomplete: (selection: AutocompleteSelection) => void,
) => void;

export interface SearchBoxState {
  allAutocompletedItemsCount: number;
  autocompleteView: unknown;
  autocompleteResults: boolean | Partial<AutocompleteResult> | undefined;
  autocompleteSuggestions: boolean | AutocompleteSuggestion | undefined;
  autocompletedResults: AutocompletedResult[];
  autocompletedSuggestions: AutocompletedSuggestions;
  autocompletedSuggestionsCount: number;
  completeSuggestion: (searchTerm: string) => void;
  isFocused: boolean | undefined;
  notifyAutocompleteSelected: (selection: AutocompleteSelection) => void;
  onChange: (valueOrEvent: string | Event) => void;
  onSelectAutocomplete: (selection: AutocompleteSelection) => void;
  onSubmit: (event: Event) => void;
  useAutocomplete: boolean;
  value: string | undefined;
  inputProps: InputProps;
  inputView: unknown;
}

export interface SearchBoxViewSignature {
  Element: Element;
  Args: SearchBoxState;
}

export interface SearchBoxContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    autocompleteMinimumCharacters?: number;
    autocompleteResults?: boolean | Partial<AutocompleteResult>;
    autocompleteSuggestions?: boolean | AutocompleteSuggestion;
    autocompleteView?: unknown;
    debounceLength?: number;
    /**
     * Called when an autocomplete item is selected, instead of the default
     * handler (open the result's url / complete the suggestion), which is
     * passed as the third argument.
     */
    onSelectAutocomplete?: OnSelectAutocomplete;
    /**
     * @deprecated Use `@onSelectAutocomplete`. Replaces the default handler
     * and only receives the selection.
     */
    handleOnSelectAutocomplete?: (selection: AutocompleteSelection) => void;
    inputProps?: Partial<InputProps>;
    inputView?: unknown;
    onSubmit?: (setSearchTerm: SetSearchTerm, searchTerm: string) => void;
    searchAsYouType?: boolean;
    shouldClearFilters?: boolean;
    view?: ViewArg<SearchBoxViewSignature>;
  };
  Blocks: { default: [SearchBoxState] };
}

type SearchBoxContext = MappedContext<
  | 'autocompletedResults'
  | 'autocompletedSuggestions'
  | 'searchTerm'
  | 'setSearchTerm'
  | 'trackAutocompleteClickThrough'
>;

const asAutocompleteResult = (
  value: SearchBoxContainerSignature['Args']['autocompleteResults'],
) => value as Partial<AutocompleteResult> | undefined;

export default class SearchBoxContainer extends Component<SearchBoxContainerSignature> {
  @tracked isFocused?: boolean;

  get View() {
    return resolveComponent(this, this.args.view);
  }

  get shouldClearFilters() {
    return this.args.shouldClearFilters ?? true;
  }

  onFocus = () => {
    this.isFocused = true;
  };

  onBlur = () => {
    this.isFocused = false;
  };

  get inputProps(): InputProps {
    return {
      onFocus: this.onFocus,
      onBlur: this.onBlur,
      ...(this.args.inputProps ?? {}),
    };
  }

  useAutocomplete = (searchTerm: string | undefined): boolean => {
    const { autocompleteResults, autocompleteSuggestions } = this.args;
    const minimum =
      this.args.autocompleteMinimumCharacters !== undefined
        ? this.args.autocompleteMinimumCharacters
        : 0;
    return (
      (!!autocompleteResults || !!autocompleteSuggestions) &&
      (searchTerm?.length as number) >= minimum
    );
  };

  suggestionsCount = (state: SearchBoxContext) =>
    countAutocompletedSuggestions(state.autocompletedSuggestions);

  allItemsCount = (state: SearchBoxContext) =>
    this.suggestionsCount(state) + state.autocompletedResults.length;

  onSelectAutocomplete = (state: SearchBoxContext) => {
    const defaultOnSelectAutocomplete = (selection: AutocompleteSelection) =>
      this.defaultOnSelectAutocomplete(
        state.trackAutocompleteClickThrough,
        state.setSearchTerm,
        selection,
      );
    const { onSelectAutocomplete, handleOnSelectAutocomplete } = this.args;

    if (onSelectAutocomplete) {
      return (selection: AutocompleteSelection) =>
        onSelectAutocomplete(
          selection,
          {
            setSearchTerm: state.setSearchTerm,
            autocompleteResults: this.args.autocompleteResults,
            autocompleteSuggestions: this.args.autocompleteSuggestions,
          },
          defaultOnSelectAutocomplete,
        );
    }
    return handleOnSelectAutocomplete ?? defaultOnSelectAutocomplete;
  };

  handleChange = (setSearchTerm: SetSearchTerm, e: string | Event) => {
    let value = '';
    if (typeof e === 'string') {
      value = e;
    } else if (
      typeof (e?.target as HTMLInputElement | null)?.value === 'string'
    ) {
      value = (e.target as HTMLInputElement).value;
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
  };

  defaultOnSelectAutocomplete = (
    trackAutocompleteClickThrough: TrackAutocompleteClickThrough,
    setSearchTerm: SetSearchTerm,
    selection: AutocompleteSelection,
  ) => {
    if (!selection) return;

    // `@autocompleteResults` may be `true` (no config) or omitted.
    const autocompleteResults =
      asAutocompleteResult(this.args.autocompleteResults) ?? {};

    this.handleNotifyAutocompleteSelected(
      trackAutocompleteClickThrough,
      selection,
    );
    if (!selection.suggestion) {
      const urlField = selection[autocompleteResults.urlField!] as
        { raw: string } | undefined;
      const url = urlField ? urlField.raw : '';
      if (url) {
        const target = autocompleteResults.linkTarget || '_self';
        window.open(url, target);
      }
    } else {
      this.completeSuggestion(setSearchTerm, selection.suggestion);
    }
  };

  handleSubmit = (
    setSearchTerm: SetSearchTerm,
    searchTerm: string,
    e: Event,
  ) => {
    const { onSubmit } = this.args;
    e.preventDefault();
    if (onSubmit) {
      onSubmit(setSearchTerm, searchTerm);
    }

    setSearchTerm(searchTerm, {
      shouldClearFilters: this.shouldClearFilters,
    });
  };

  completeSuggestion = (setSearchTerm: SetSearchTerm, searchTerm: string) => {
    setSearchTerm(searchTerm, {
      shouldClearFilters: this.shouldClearFilters,
    });
  };

  handleNotifyAutocompleteSelected = (
    trackAutocompleteClickThrough: TrackAutocompleteClickThrough,
    selection: AutocompleteSelection,
  ) => {
    const autocompleteResults = asAutocompleteResult(
      this.args.autocompleteResults,
    );
    // Because suggestions don't count as clickthroughs, only
    // results
    if (
      autocompleteResults &&
      autocompleteResults.shouldTrackClickThrough !== false &&
      !selection.suggestion
    ) {
      const { clickThroughTags = [] } = autocompleteResults;
      const id = (selection['id'] as { raw: string }).raw;
      trackAutocompleteClickThrough(id, clickThroughTags);
    }
  };

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "autocompletedResults"
        "autocompletedSuggestions"
        "searchTerm"
        "setSearchTerm"
        "trackAutocompleteClickThrough"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @allAutocompletedItemsCount={{this.allItemsCount state}}
          @autocompleteView={{@autocompleteView}}
          @autocompleteResults={{@autocompleteResults}}
          @autocompleteSuggestions={{@autocompleteSuggestions}}
          @autocompletedResults={{state.autocompletedResults}}
          @autocompletedSuggestions={{state.autocompletedSuggestions}}
          @autocompletedSuggestionsCount={{this.suggestionsCount state}}
          @completeSuggestion={{fn this.completeSuggestion state.setSearchTerm}}
          @isFocused={{this.isFocused}}
          @notifyAutocompleteSelected={{fn
            this.handleNotifyAutocompleteSelected
            state.trackAutocompleteClickThrough
          }}
          @onChange={{fn this.handleChange state.setSearchTerm}}
          @onSelectAutocomplete={{this.onSelectAutocomplete state}}
          @onSubmit={{fn
            this.handleSubmit
            state.setSearchTerm
            (if state.searchTerm state.searchTerm "")
          }}
          @useAutocomplete={{this.useAutocomplete state.searchTerm}}
          @value={{state.searchTerm}}
          @inputProps={{this.inputProps}}
          @inputView={{@inputView}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            allAutocompletedItemsCount=(this.allItemsCount state)
            autocompleteView=@autocompleteView
            autocompleteResults=@autocompleteResults
            autocompleteSuggestions=@autocompleteSuggestions
            autocompletedResults=state.autocompletedResults
            autocompletedSuggestions=state.autocompletedSuggestions
            autocompletedSuggestionsCount=(this.suggestionsCount state)
            completeSuggestion=(fn this.completeSuggestion state.setSearchTerm)
            isFocused=this.isFocused
            notifyAutocompleteSelected=(fn
              this.handleNotifyAutocompleteSelected
              state.trackAutocompleteClickThrough
            )
            onChange=(fn this.handleChange state.setSearchTerm)
            onSelectAutocomplete=(this.onSelectAutocomplete state)
            onSubmit=(fn
              this.handleSubmit
              state.setSearchTerm
              (if state.searchTerm state.searchTerm "")
            )
            useAutocomplete=(this.useAutocomplete state.searchTerm)
            value=state.searchTerm
            inputProps=this.inputProps
            inputView=@inputView
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
