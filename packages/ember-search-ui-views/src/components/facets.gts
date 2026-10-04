import type { TOC } from '@ember/component/template-only';
import '../styles/ember-search-ui-views.css';

const Facets: TOC<{
  Element: HTMLDivElement;
  Blocks: { default: [] };
}> = <template>
  <div class="sui-facet-container" ...attributes>
    {{yield}}
  </div>
</template>;

export default Facets;
