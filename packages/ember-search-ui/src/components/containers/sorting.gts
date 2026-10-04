import Component from '@glimmer/component';
import { fn, hash } from '@ember/helper';
import type {
  SearchDriver,
  SearchDriverActions,
  SortDirection,
} from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import formatValue from '../../helpers/format-value.ts';
import { findSortOption } from '../../helpers/find-sort-option.ts';
import { formatSelectOption } from '../../helpers/format-select-option.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';
import type { SelectOption, SortingOption } from '../../types.ts';

export interface SortingState {
  label: string | undefined;
  options: SelectOption[];
  setSort: SearchDriverActions['setSort'];
  sortDirection: SortDirection | undefined;
  sortField: string | undefined;
  /** Accepts a formatted value (`field|||direction`) or a `SelectOption`. */
  onChange: (selection: string | { value: string } | undefined) => void;
  value: string;
}

export interface SortingViewSignature {
  Element: Element;
  Args: SortingState;
}

export interface SortingContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    sortOptions?: SortingOption[];
    label?: string;
    view?: ViewArg<SortingViewSignature>;
  };
  Blocks: { default: [SortingState] };
}

export default class SortingContainer extends Component<SortingContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  get options(): SelectOption[] {
    return (this.args.sortOptions ?? []).map(formatSelectOption);
  }

  setSort = (
    setSort: SearchDriverActions['setSort'],
    sortOptions: SortingOption[] | undefined,
    e: string | { value: string } | undefined,
  ) => {
    const sortString = (typeof e === 'object' && e?.value) || (e as string);
    const sortOption = findSortOption(sortOptions ?? [], sortString)!;
    setSort(sortOption.value, sortOption.direction);
  };

  value = (sortField: string | undefined, sortDirection: string | undefined) =>
    formatValue(sortField as string, sortDirection as string);

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "sortDirection"
        "sortField"
        "setSort"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @label={{@label}}
          @options={{this.options}}
          @setSort={{state.setSort}}
          @sortDirection={{state.sortDirection}}
          @sortField={{state.sortField}}
          @onChange={{fn this.setSort state.setSort @sortOptions}}
          @value={{this.value state.sortField state.sortDirection}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            label=@label
            options=this.options
            setSort=state.setSort
            sortDirection=state.sortDirection
            sortField=state.sortField
            onChange=(fn this.setSort state.setSort @sortOptions)
            value=(this.value state.sortField state.sortDirection)
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
