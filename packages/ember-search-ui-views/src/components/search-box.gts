import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import { on } from '@ember/modifier';
import SearchBoxContainer, {
  type SearchBoxContainerSignature,
  type SearchBoxState,
} from 'ember-search-ui/components/containers/search-box';
import buildAutocompleteGroups, {
  type AutocompleteGroup,
} from '../helpers/build-autocomplete-groups.ts';
import { and, gt, pipe } from '../-private/template-helpers.ts';
import AutocompleteInput from './autocomplete-input.gts';
import '../styles/ember-search-ui-views.css';

type ContainerArgs = SearchBoxContainerSignature['Args'];

export interface SearchBoxSignature {
  Element: Element;
  Args: ContainerArgs;
}

export default class SearchBox extends Component<SearchBoxSignature> {
  getText = (group: AutocompleteGroup, option: unknown) =>
    group.getText(option as never) as string;

  /** What clicking an autocomplete item does, before the menu closes. */
  selectItem = (
    state: SearchBoxState,
    group: AutocompleteGroup,
    option: unknown,
  ) =>
    group.isSuggestionGroup
      ? fnWith(state.completeSuggestion, this.getText(group, option))
      : fnWith(state.onSelectAutocomplete, option as Record<string, unknown>);

  <template>
    <SearchBoxContainer
      @driver={{@driver}}
      @view={{@view}}
      @autocompleteMinimumCharacters={{@autocompleteMinimumCharacters}}
      @autocompleteResults={{@autocompleteResults}}
      @autocompleteSuggestions={{@autocompleteSuggestions}}
      @autocompleteView={{@autocompleteView}}
      @shouldClearFilters={{@shouldClearFilters}}
      @debounceLength={{@debounceLength}}
      @inputProps={{@inputProps}}
      @inputView={{@inputView}}
      @onSelectAutocomplete={{@onSelectAutocomplete}}
      @handleOnSelectAutocomplete={{@handleOnSelectAutocomplete}}
      @onSubmit={{@onSubmit}}
      @searchAsYouType={{@searchAsYouType}}
      ...attributes
      as |state|
    >
      {{#let
        (buildAutocompleteGroups
          (hash
            autocompleteResults=state.autocompleteResults
            autocompletedResults=state.autocompletedResults
            autocompleteSuggestions=state.autocompleteSuggestions
            autocompletedSuggestions=state.autocompletedSuggestions
          )
        )
        as |groups|
      }}
        <form {{on "submit" state.onSubmit}}>
          <AutocompleteInput
            class="sui-search-box"
            @classIfOpen="autocomplete"
            as |menu|
          >
            <menu.Input
              class={{state.inputProps.class}}
              @value={{state.value}}
              @onInput={{state.onChange}}
              @placeholder={{state.inputProps.placeholder}}
            />
            {{#if (and (gt state.allAutocompletedItemsCount 0) menu.isOpen)}}
              <menu.Items
                role="listbox"
                class="sui-search-box__autocomplete-container"
                as |items|
              >
                <div>
                  {{#each groups as |group|}}
                    {{#if (and group.groupName group.options)}}
                      <div class="sui-search-box__section-title">
                        {{group.groupName}}
                      </div>
                    {{/if}}
                    <ul class={{group.class}}>
                      {{#each group.options as |opt|}}
                        <items.Item as |item|>
                          <item.Element
                            @tagName="li"
                            aria-selected="{{item.isActive}}"
                            @onClick={{pipe
                              (this.selectItem state group opt)
                              menu.closeMenu
                            }}
                          >
                            <span>
                              {{{this.getText group opt}}}
                            </span>
                          </item.Element>
                        </items.Item>
                      {{/each}}
                    </ul>
                  {{/each}}
                </div>
              </menu.Items>
            {{/if}}
          </AutocompleteInput>
        </form>
      {{/let}}
    </SearchBoxContainer>
  </template>
}

/** `(fn action arg)` as a plain function, so it can be chosen in JS. */
function fnWith<A, R>(action: (arg: A, ...rest: unknown[]) => R, arg: A) {
  return (...rest: unknown[]) => action(arg, ...rest);
}
