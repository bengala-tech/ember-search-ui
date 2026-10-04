import type { TOC } from '@ember/component/template-only';
import { concat, fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { FacetViewArgs } from '../types.ts';
import getFilterValueDisplay from '../helpers/get-filter-value-display.ts';
// Not bound as `toLocaleString`: the template compiler mistakes Object.prototype
// names for keywords and crashes.
import formatLocaleString from '../helpers/to-locale-string.ts';
import { optional } from '../-private/template-helpers.ts';
import '../styles/ember-search-ui-views.css';

const MultiCheckboxFacet: TOC<{
  Element: HTMLFieldSetElement;
  Args: FacetViewArgs;
}> = <template>
  <fieldset class="sui-facet" ...attributes>
    <legend class="sui-facet__title">
      {{@label}}
    </legend>
    {{#if @showSearch}}
      <div class="sui-facet-search">
        <input
          class="sui-facet-search__text-input"
          type="search"
          placeholder={{if @searchPlaceholder @searchPlaceholder "Search"}}
          {{on "input" (optional @onSearch)}}
        />
      </div>
    {{/if}}
    <div class="sui-multi-checkbox-facet">
      {{#each @options as |option|}}
        <label
          for={{concat
            "example_facet_"
            @label
            (getFilterValueDisplay option.value)
          }}
          class="sui-multi-checkbox-facet__option-label"
        >
          <div class="sui-multi-checkbox-facet__option-input-wapper">
            <input
              id={{concat
                "example_facet_"
                @label
                (getFilterValueDisplay option.value)
              }}
              type="checkbox"
              class="sui-multi-checkbox-facet__checkbox"
              checked={{option.selected}}
              {{on
                "change"
                (if
                  option.selected
                  (fn @onRemove option.value)
                  (fn @onSelect option.value)
                )
              }}
            />
            <span class="sui-multi-checkbox-facet__input-text">
              {{getFilterValueDisplay option.value}}
            </span>
          </div>
          <span class="sui-multi-checkbox-facet__option-count">
            {{formatLocaleString option.count "en"}}
          </span>
        </label>
      {{else}}
        <div>
          No matching options
        </div>
      {{/each}}
    </div>
    {{#if @showMore}}
      <button
        type="button"
        class="sui-facet-view-more"
        aria-label="Show more options"
        {{on "click" (optional @onMoreClick)}}
      >
        + More
      </button>
    {{/if}}
  </fieldset>
</template>;

export default MultiCheckboxFacet;
