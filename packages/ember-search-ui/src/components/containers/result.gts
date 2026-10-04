import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { SearchDriver, SearchResult } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';
import type { SearchDriverActions } from '@elastic/search-ui';

export interface ResultState {
  result: SearchResult;
  onClickLink: ((event?: Event) => void) | undefined;
  titleField: string | undefined;
  urlField: string | undefined;
}

export interface ResultViewSignature {
  Element: Element;
  Args: ResultState;
}

export interface ResultContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    result: SearchResult;
    titleField?: string;
    urlField?: string;
    shouldTrackClickThrough?: boolean;
    clickThroughTags?: string[];
    view?: ViewArg<ResultViewSignature>;
  };
  Blocks: { default: [ResultState] };
}

export default class ResultContainer extends Component<ResultContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  get clickThroughTags(): string[] {
    return this.args.clickThroughTags ?? [];
  }

  onClickLink = (
    trackClickThrough: SearchDriverActions['trackClickThrough'],
  ): ResultState['onClickLink'] => {
    if (!this.args.shouldTrackClickThrough) return undefined;
    const id = (this.args.result['id'] as { raw: string } | undefined)?.raw;
    const tags = this.clickThroughTags;
    return () => trackClickThrough(id!, tags);
  };

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps "trackClickThrough"}}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View
          @result={{@result}}
          @onClickLink={{this.onClickLink state.trackClickThrough}}
          @titleField={{@titleField}}
          @urlField={{@urlField}}
          ...attributes
        />
      {{else}}
        {{yield
          (hash
            result=@result
            onClickLink=(this.onClickLink state.trackClickThrough)
            titleField=@titleField
            urlField=@urlField
          )
        }}
      {{/if}}
    </WithSearch>
  </template>
}
