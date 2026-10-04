import type { TOC } from '@ember/component/template-only';
import ResultsContainer, {
  type ResultsContainerSignature,
} from 'ember-search-ui/components/containers/results';
import argOrDefault from 'ember-search-ui/helpers/arg-or-default';
import Result from './result.gts';
import '../styles/ember-search-ui-views.css';

type ContainerArgs = ResultsContainerSignature['Args'];

const Results: TOC<{
  Element: HTMLUListElement;
  Args: Pick<
    ContainerArgs,
    | 'driver'
    | 'view'
    | 'titleField'
    | 'urlField'
    | 'shouldTrackClickThrough'
    | 'clickThroughTags'
    | 'resultView'
  >;
}> = <template>
  <ul class="sui-results-container" ...attributes>
    <ResultsContainer
      @driver={{@driver}}
      @view={{@view}}
      @titleField={{@titleField}}
      @urlField={{@urlField}}
      @shouldTrackClickThrough={{@shouldTrackClickThrough}}
      @clickThroughTags={{@clickThroughTags}}
      @resultView={{argOrDefault @resultView Result}}
    />
  </ul>
</template>;

export default Results;
