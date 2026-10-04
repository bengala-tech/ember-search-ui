import { emptyRoot } from './tree.ts';
import type { SearchState } from './types.ts';

export const DEFAULT_PER_PAGE = 20;

export function createState(partial: Partial<SearchState> = {}): SearchState {
  return {
    query: { term: '' },
    filter: emptyRoot(),
    sort: [],
    page: { kind: 'offset', page: 1, perPage: DEFAULT_PER_PAGE },
    extensions: {},
    ...partial,
  };
}

/** The first page, keeping the page size (or cursor size). */
export function firstPage(page: SearchState['page']): SearchState['page'] {
  return page.kind === 'offset'
    ? { ...page, page: 1 }
    : { ...page, cursor: null };
}
