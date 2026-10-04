import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { SearchDriver } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export interface ResultsPerPageState {
  onChange: (resultsPerPage: number) => void;
  options: number[];
  value: number | undefined;
}

export interface ResultsPerPageViewSignature {
  Element: Element;
  Args: ResultsPerPageState;
}

export interface ResultsPerPageContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    options?: number[];
    view?: ViewArg<ResultsPerPageViewSignature>;
  };
  Blocks: { default: [ResultsPerPageState] };
}

const DEFAULT_OPTIONS = [20, 40, 60];

export default class ResultsPerPageContainer extends Component<ResultsPerPageContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  get options() {
    return this.args.options ? this.args.options : DEFAULT_OPTIONS;
  }

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps
        "resultsPerPage"
        "setResultsPerPage"
      }}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @onChange={{state.setResultsPerPage}}
          @options={{this.options}}
          @value={{state.resultsPerPage}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            onChange=state.setResultsPerPage
            options=this.options
            value=state.resultsPerPage
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
