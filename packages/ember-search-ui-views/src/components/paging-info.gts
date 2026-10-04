import type { TOC } from '@ember/component/template-only';
import type { SearchDriver } from '@elastic/search-ui';
import PagingInfoContainer from 'ember-search-ui/components/containers/paging-info';
import '../styles/ember-search-ui-views.css';

const PagingInfo: TOC<{
  Element: HTMLDivElement;
  Args: { driver: SearchDriver };
}> = <template>
  <PagingInfoContainer @driver={{@driver}} as |state|>
    <div class="sui-paging-info" ...attributes>
      Showing
      <strong>
        {{state.start}}
        -
        {{state.end}}
      </strong>
      out of
      <strong>
        {{state.totalResults}}
      </strong>
      {{#if state.searchTerm}}
        for:
        <em>
          {{state.searchTerm}}
        </em>
      {{/if}}
    </div>
  </PagingInfoContainer>
</template>;

export default PagingInfo;
