import type { TOC } from '@ember/component/template-only';
import PowerSelect from 'ember-power-select/components/power-select';
import type { FacetViewArgs } from '../types.ts';
import mapFacetOptions from '../helpers/map-facet-options.ts';
import pickValue from '../helpers/pick-value.ts';
// Not bound as `toLocaleString`: the template compiler mistakes Object.prototype
// names for keywords and crashes.
import formatLocaleString from '../helpers/to-locale-string.ts';
import { pipe } from '../-private/template-helpers.ts';
import Trigger from './trigger.gts';
import 'ember-basic-dropdown/styles';
import 'ember-power-select/styles';
import '../styles/ember-search-ui-views.css';

const SingleSelectFacet: TOC<{
  Element: HTMLElement;
  Args: FacetViewArgs;
}> = <template>
  {{#let (mapFacetOptions @options) as |selectBoxOptions|}}
    <div class="sui-facet" ...attributes>
      <div class="sui-facet__title">
        {{@label}}
      </div>
      <PowerSelect
        class="sui-select"
        @triggerClass="sui-select__control"
        @dropdownClass="sui-select__menu"
        @triggerComponent={{Trigger}}
        @matchTriggerWidth={{true}}
        @renderInPlace={{true}}
        @placeholder="Select..."
        @options={{selectBoxOptions.options}}
        @selected={{selectBoxOptions.selectedSelectBoxOption}}
        @onChange={{pipe (pickValue "value") @onChange}}
        as |option|
      >
        <span class="sui-select__option-label">
          {{option.label}}
        </span>
        <span class="sui-select__option-count">
          {{formatLocaleString option.count}}
        </span>
      </PowerSelect>
    </div>
  {{/let}}
</template>;

export default SingleSelectFacet;
