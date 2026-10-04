import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { SelectableFacetValue } from 'ember-search-ui';
import type { FacetViewArgs } from '../types.ts';
import getFilterValueDisplay from '../helpers/get-filter-value-display.ts';
import { preventDefault } from '../-private/template-helpers.ts';
import '../styles/ember-search-ui-views.css';

const selectedValue = (options: SelectableFacetValue[] | undefined) =>
  (options ?? [])
    .filter((option) => option.selected)
    .map((option) => option.value)[0];

const SingleLinksFacet: TOC<{
  Element: HTMLDivElement;
  Args: FacetViewArgs;
}> = <template>
  {{#let (selectedValue @options) as |value|}}
    <div class="sui-facet" ...attributes>
      <div>
        <div class="sui-facet__title">
          {{@label}}
        </div>
        <ul class="sui-single-option-facet">
          {{#if value}}
            <li class="sui-single-option-facet__selected">
              {{getFilterValueDisplay value}}
              <span class="sui-single-option-facet__remove">
                (
                <a
                  href="/"
                  {{on "click" (preventDefault (fn @onRemove value))}}
                >
                  Remove
                </a>
                )
              </span>
            </li>
          {{else}}
            {{#each @options as |option|}}
              <li class="sui-single-option-facet__item">
                <a
                  class="sui-single-option-facet__link"
                  href="/"
                  {{on "click" (preventDefault (fn @onSelect option.value))}}
                >
                  {{getFilterValueDisplay option.value}}
                </a>
                <span class="sui-facet__count">
                  {{option.count}}
                </span>
              </li>
            {{/each}}
          {{/if}}
        </ul>
      </div>
    </div>
  {{/let}}
</template>;

export default SingleLinksFacet;
