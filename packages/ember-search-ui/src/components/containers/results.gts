import Component from '@glimmer/component';
import type { SearchDriver } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import ResultContainer, { type ResultViewSignature } from './result.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export interface ResultsViewSignature {
  Element: Element;
  Blocks: { default: [] };
}

export interface ResultsContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    titleField?: string;
    urlField?: string;
    shouldTrackClickThrough?: boolean;
    clickThroughTags?: string[];
    view?: ViewArg<ResultsViewSignature>;
    /** Defaults to the app's `result` component. */
    resultView?: ViewArg<ResultViewSignature>;
  };
}

export default class ResultsContainer extends Component<ResultsContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  get clickThroughTags(): string[] {
    return this.args.clickThroughTags ?? [];
  }

  get shouldTrackClickThrough(): true | undefined {
    return this.args.shouldTrackClickThrough ? true : undefined;
  }

  get resultView(): ViewArg<ResultViewSignature> {
    return this.args.resultView ? this.args.resultView : 'result';
  }

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps "results"}}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View ...attributes>
          {{#each state.results as |result|}}
            <ResultContainer
              @driver={{@driver}}
              @titleField={{@titleField}}
              @urlField={{@urlField}}
              @view={{this.resultView}}
              @result={{result}}
              @shouldTrackClickThrough={{this.shouldTrackClickThrough}}
              @clickThroughTags={{this.clickThroughTags}}
            />
          {{/each}}
        </this.View>
      {{else}}
        {{#each state.results as |result|}}
          <ResultContainer
            @driver={{@driver}}
            @titleField={{@titleField}}
            @urlField={{@urlField}}
            @view={{this.resultView}}
            @result={{result}}
            @shouldTrackClickThrough={{this.shouldTrackClickThrough}}
            @clickThroughTags={{this.clickThroughTags}}
          />
        {{/each}}
      {{/if}}
    </WithSearch>
  </template>
}
