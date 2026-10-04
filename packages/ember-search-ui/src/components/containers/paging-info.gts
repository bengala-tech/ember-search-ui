import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { SearchDriver } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export interface PagingInfoState {
  searchTerm: string;
  start: number;
  end: number;
  totalResults: number;
}

export interface PagingInfoViewSignature {
  Element: Element;
  Args: PagingInfoState;
}

export interface PagingInfoContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    view?: ViewArg<PagingInfoViewSignature>;
  };
  Blocks: { default: [PagingInfoState] };
}

export default class PagingInfoContainer extends Component<PagingInfoContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "pagingStart"
        "pagingEnd"
        "resultSearchTerm"
        "totalResults"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @searchTerm={{state.resultSearchTerm}}
          @start={{state.pagingStart}}
          @end={{state.pagingEnd}}
          @totalResults={{state.totalResults}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            searchTerm=state.resultSearchTerm
            start=state.pagingStart
            end=state.pagingEnd
            totalResults=state.totalResults
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
