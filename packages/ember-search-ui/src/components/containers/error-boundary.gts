import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import type { SearchDriver } from '@elastic/search-ui';
import WithSearch from '../with-search.gts';
import mapContextToProps from '../../helpers/map-context-to-props.ts';
import {
  resolveComponent,
  type ViewArg,
} from '../../utils/resolve-component.ts';

export interface ErrorBoundaryViewSignature {
  Element: Element;
  Args: { error: string };
}

export interface ErrorBoundaryContainerSignature {
  Element: Element;
  Args: {
    driver: SearchDriver;
    view?: ViewArg<ErrorBoundaryViewSignature>;
  };
  Blocks: { default: [{ error: string }] };
}

export default class ErrorBoundaryContainer extends Component<ErrorBoundaryContainerSignature> {
  get View() {
    return resolveComponent(this, this.args.view);
  }

  <template>
    <WithSearch
      @mapContextToProps={{mapContextToProps "error"}}
      @driver={{@driver}}
      as |state|
    >
      {{#if this.View}}
        <this.View @error={{state.error}} ...attributes />
      {{else}}
        {{yield (hash error=state.error)}}
      {{/if}}
    </WithSearch>
  </template>
}
