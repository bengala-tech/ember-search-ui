import type { TOC } from '@ember/component/template-only';
import type { SearchDriver } from '@elastic/search-ui';
import ErrorBoundaryContainer from 'ember-search-ui/components/containers/error-boundary';
import '../styles/ember-search-ui-views.css';

const ErrorBoundary: TOC<{
  Element: HTMLDivElement;
  Args: { driver: SearchDriver };
  Blocks: { default: [] };
}> = <template>
  <ErrorBoundaryContainer @driver={{@driver}} as |state|>
    {{#if state.error}}
      <div class="sui-search-error" ...attributes>
        {{state.error}}
      </div>
    {{/if}}
    {{yield}}
  </ErrorBoundaryContainer>
</template>;

export default ErrorBoundary;
