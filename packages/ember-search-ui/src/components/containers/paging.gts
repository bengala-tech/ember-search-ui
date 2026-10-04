import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { SearchDriver } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export interface PagingState {
  current: number | undefined;
  resultsPerPage: number | undefined;
  totalPages: number;
  onChange: (current: number) => void;
}

export interface PagingViewSignature {
  Element: Element;
  Args: PagingState;
}

export interface PagingContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    view?: ViewArg<PagingViewSignature>;
  };
  Blocks: { default: [PagingState] };
}

export default class PagingContainer extends Component<PagingContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "current"
        "resultsPerPage"
        "totalPages"
        "setCurrent"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @current={{state.current}}
          @resultsPerPage={{state.resultsPerPage}}
          @totalPages={{state.totalPages}}
          @onChange={{state.setCurrent}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            current=state.current
            resultsPerPage=state.resultsPerPage
            totalPages=state.totalPages
            onChange=state.setCurrent
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
