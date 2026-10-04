import type { TOC } from '@ember/component/template-only';
import PowerSelect from 'ember-power-select/components/power-select';
import SortingContainer, {
  type SortingContainerSignature,
} from 'ember-search-ui/components/containers/sorting';
import { findBy } from '../-private/template-helpers.ts';
import Trigger from './trigger.gts';
import 'ember-basic-dropdown/styles';
import 'ember-power-select/styles';
import '../styles/ember-search-ui-views.css';

const Sorting: TOC<{
  Element: Element;
  Args: SortingContainerSignature['Args'];
}> = <template>
  <SortingContainer
    @driver={{@driver}}
    @view={{@view}}
    @sortOptions={{@sortOptions}}
    @label={{@label}}
    ...attributes
    as |state|
  >
    <div class="sui-sorting" ...attributes>
      {{#if state.label}}
        <div class="sui-sorting__label">
          {{state.label}}
        </div>
      {{/if}}
      <PowerSelect
        class="sui-select"
        @triggerClass="sui-select__control"
        @dropdownClass="sui-select__menu"
        @triggerComponent={{Trigger}}
        @renderInPlace={{true}}
        @options={{state.options}}
        @selected={{findBy "value" state.value state.options}}
        @onChange={{state.onChange}}
        as |option|
      >
        {{option.label}}
      </PowerSelect>
    </div>
  </SortingContainer>
</template>;

export default Sorting;
