import type { TOC } from '@ember/component/template-only';
import type { LegacyListValuesArgs } from 'ember-search-ui';

const words = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).map(String).join(' or ');

/** A legacy `listValue` chip: one badge per filter value. */
const StateBadge: TOC<{ Args: LegacyListValuesArgs }> = <template>
  <li class="state-badge" data-test-state-badge>State: {{words @value}}</li>
</template>;

export default StateBadge;
