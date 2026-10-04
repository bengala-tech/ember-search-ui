import type { TOC } from '@ember/component/template-only';
import type { SearchDriver } from '@elastic/search-ui';
import PowerSelect from 'ember-power-select/components/power-select';
import ResultsPerPageContainer from 'ember-search-ui/components/containers/results-per-page';
import wrapOptions from '../helpers/wrap-options.ts';
import pickValue from '../helpers/pick-value.ts';
import { findBy, pipe } from '../-private/template-helpers.ts';
import Trigger from './trigger.gts';
import 'ember-basic-dropdown/styles';
import 'ember-power-select/styles';
import '../styles/ember-search-ui-views.css';

const ResultsPerPage: TOC<{
  Element: HTMLDivElement;
  Args: { driver: SearchDriver };
}> = <template>
  <ResultsPerPageContainer @driver={{@driver}} as |state|>
    {{#let (wrapOptions state.options) as |wrappedOptions|}}
      <div class="sui-results-per-page" ...attributes>
        <div class="sui-results-per-page__label">
          Show
        </div>
        <PowerSelect
          class="sui-select sui-select--inline"
          style="width: 100px;"
          @triggerClass="sui-select__control"
          @dropdownClass="sui-select__menu"
          @triggerComponent={{Trigger}}
          @matchTriggerWidth={{true}}
          @renderInPlace={{true}}
          @options={{wrappedOptions}}
          @selected={{findBy "value" state.value wrappedOptions}}
          @onChange={{pipe (pickValue "value") state.onChange}}
          as |option|
        >
          {{option.label}}
        </PowerSelect>
      </div>
    {{/let}}
  </ResultsPerPageContainer>
</template>;

export default ResultsPerPage;
