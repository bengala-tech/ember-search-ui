import type { FacetState } from 'ember-search-ui';

type FacetCallbacks = 'onRemove' | 'onSelect' | 'onChange';

/**
 * Args for facet views (MultiCheckboxFacet, BooleanFacet, ...). The container
 * always provides everything; only the callbacks are required so views can
 * also be rendered standalone.
 */
export type FacetViewArgs = Pick<FacetState, FacetCallbacks> &
  Partial<Omit<FacetState, FacetCallbacks>>;
