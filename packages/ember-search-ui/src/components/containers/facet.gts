import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn, hash } from '@ember/helper';
import type {
  FacetValue,
  FilterType,
  FilterValue,
  SearchDriver,
  SearchDriverActions,
} from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps, {
  type MappedContext,
} from '../../helpers/map-context-to-props.ts';
import { markSelectedFacetValuesFromFilters } from '../../helpers/mark-selected-facet-values-from-filters.ts';
import { filterFacetValues } from '../../helpers/filter-facet-values.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export type SelectableFacetValue = Required<FacetValue>;

export interface FacetState {
  label: string | undefined;
  onMoreClick: () => void;
  onRemove: (value: FilterValue) => void;
  onChange: (value: FilterValue) => void;
  onSelect: (value: FilterValue) => void;
  options: SelectableFacetValue[];
  showMore: boolean;
  values: FilterValue[];
  showSearch: boolean | undefined;
  onSearch: (event: Event) => void;
  searchPlaceholder: string;
}

export interface FacetViewSignature {
  Element: Element;
  Args: FacetState;
}

export interface FacetContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    field: string;
    label?: string;
    filterType?: FilterType;
    isFilterable?: boolean;
    /** How many options to show before "more" is clicked. Defaults to 5. */
    show?: number;
    options?: SelectableFacetValue[];
    view?: ViewArg<FacetViewSignature>;
  };
  Blocks: { default: [FacetState] };
}

type FacetContext = MappedContext<
  | 'filters'
  | 'facets'
  | 'addFilter'
  | 'removeFilter'
  | 'setFilter'
  | 'a11yNotify'
>;

interface FacetModel {
  filterType: FilterType;
  filteredFacetValues: SelectableFacetValue[];
  selectedValues: FilterValue[];
}

export default class FacetContainer extends Component<FacetContainerSignature> {
  @tracked more = this.args.show || 5;
  @tracked searchTerm = '';

  get View() {
    return resolveComponent(this, this.args.view);
  }

  get filterType(): FilterType {
    return this.args.filterType ? this.args.filterType : 'all';
  }

  /** Returns undefined when nothing should render for this facet. */
  model = (state: FacetContext): FacetModel | undefined => {
    const facetsForField = (state.facets as Record<string, unknown[]>)[
      this.args.field
    ];
    // `{{#if}}` treats empty arrays as falsy
    if (!facetsForField?.length) return;

    const facetValues = markSelectedFacetValuesFromFilters(
      facetsForField[0] as { data: FacetValue[] },
      state.filters ?? [],
      this.args.field,
      this.filterType,
    ).data;
    const selectedValues = facetValues
      .filter((facetValue) => facetValue.selected)
      .map((facetValue) => facetValue.value);

    if (facetValues.length === 0 && selectedValues.length === 0) return;

    return {
      filterType: this.filterType,
      filteredFacetValues: filterFacetValues(facetValues, this.searchTerm),
      selectedValues,
    };
  };

  get searchPlaceholder() {
    return `Field ${this.args.field}`;
  }

  visibleOptions = (options: SelectableFacetValue[] | undefined) =>
    (options ?? []).slice(0, this.more);

  removeFilter = (
    removeFilter: SearchDriverActions['removeFilter'],
    field: string,
    filterType: FilterType,
    value: FilterValue,
  ) => {
    removeFilter(field, value, filterType);
  };

  setFilter = (
    setFilter: SearchDriverActions['setFilter'],
    field: string,
    filterType: FilterType,
    value: FilterValue,
  ) => {
    setFilter(field, value, filterType);
  };

  addFilter = (
    addFilter: SearchDriverActions['addFilter'],
    field: string,
    filterType: FilterType,
    value: FilterValue,
  ) => {
    addFilter(field, value, filterType);
  };

  handleClickMore = (
    a11yNotify: SearchDriverActions['a11yNotify'],
    opts: number,
  ) => {
    let visibleOptionsCount = this.more + 10;
    const showingAll = visibleOptionsCount >= opts;
    if (showingAll) visibleOptionsCount = opts;

    a11yNotify('moreFilters', { visibleOptionsCount, showingAll });
    this.more = visibleOptionsCount;
  };

  onSearch = (e: Event) => {
    this.searchTerm = (e.target as HTMLInputElement).value;
  };

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "filters"
        "facets"
        "addFilter"
        "removeFilter"
        "setFilter"
        "a11yNotify"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#let (this.model state) as |model|}}
        {{#if model}}
          {{#if this.View}}
            <this.View
              @label={{@label}}
              @onMoreClick={{fn
                this.handleClickMore
                state.a11yNotify
                model.filteredFacetValues.length
              }}
              @onRemove={{fn
                this.removeFilter
                state.removeFilter
                @field
                model.filterType
              }}
              @onChange={{fn
                this.setFilter
                state.setFilter
                @field
                model.filterType
              }}
              @onSelect={{fn
                this.addFilter
                state.addFilter
                @field
                model.filterType
              }}
              @options={{this.visibleOptions model.filteredFacetValues}}
              @showMore={{if model.filteredFacetValues.length true false}}
              @values={{model.selectedValues}}
              @showSearch={{@isFilterable}}
              @onSearch={{this.onSearch}}
              @searchPlaceholder={{this.searchPlaceholder}}
              ...attributes
            />
          {{else}}
            {{yield
              (hash
                label=@label
                onMoreClick=(fn
                  this.handleClickMore
                  state.a11yNotify
                  model.filteredFacetValues.length
                )
                onRemove=(fn
                  this.removeFilter state.removeFilter @field model.filterType
                )
                onChange=(fn
                  this.setFilter state.setFilter @field model.filterType
                )
                onSelect=(fn
                  this.addFilter state.addFilter @field model.filterType
                )
                options=(this.visibleOptions @options)
                showMore=(if model.filteredFacetValues.length true false)
                values=model.selectedValues
                showSearch=@isFilterable
                onSearch=this.onSearch
                searchPlaceholder=this.searchPlaceholder
              )
            }}
          {{/if}}
        {{/if}}
      {{/let}}
    </WithSearch>
  </template>
}
