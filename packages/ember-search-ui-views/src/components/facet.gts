import type { TOC } from '@ember/component/template-only';
import FacetContainer, {
  type FacetContainerSignature,
} from 'ember-search-ui/components/containers/facet';
import argOrDefault from 'ember-search-ui/helpers/arg-or-default';
import MultiCheckboxFacet from './multi-checkbox-facet.gts';
import '../styles/ember-search-ui-views.css';

type ContainerArgs = FacetContainerSignature['Args'];

const Facet: TOC<{
  Element: Element;
  Args: Pick<
    ContainerArgs,
    'driver' | 'field' | 'label' | 'filterType' | 'isFilterable' | 'view'
  >;
}> = <template>
  <FacetContainer
    @filterType={{@filterType}}
    @view={{argOrDefault @view MultiCheckboxFacet}}
    @isFilterable={{@isFilterable}}
    @label={{@label}}
    @driver={{@driver}}
    @field={{@field}}
    ...attributes
  />
</template>;

export default Facet;
