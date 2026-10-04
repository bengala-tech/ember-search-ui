import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { FacetViewArgs } from '../types.ts';
import { findBy, includes } from '../-private/template-helpers.ts';
import '../styles/ember-search-ui-views.css';

const BooleanFacet: TOC<{
  Element: HTMLFieldSetElement;
  Args: FacetViewArgs;
}> = <template>
  {{#let (findBy "value" "true" @options) as |truthyOptions|}}
    {{#if truthyOptions}}
      {{#let (includes "true" @values) as |isSelected|}}
        <fieldset class="sui-facet" ...attributes>
          <legend class="sui-facet__title">
            {{@label}}
          </legend>
          <div class="sui-boolean-facet">
            <div class="sui-boolean-facet__option-input-wrapper">
              <label class="sui-boolean-facet__option-label">
                <div class="sui-boolean-facet__option-input-wrapper">
                  <input
                    class="sui-boolean-facet__checkbox"
                    type="checkbox"
                    checked={{isSelected}}
                    {{on
                      "change"
                      (if
                        isSelected (fn @onRemove "true") (fn @onChange "true")
                      )
                    }}
                  />
                  <span class="sui-boolean-facet__input-text">
                    {{@label}}
                  </span>
                </div>
                <span class="sui-boolean-facet__option-count">
                  {{truthyOptions.count}}
                </span>
              </label>
            </div>
          </div>
        </fieldset>
      {{/let}}
    {{/if}}
  {{/let}}
</template>;

export default BooleanFacet;
