import {
  SearchDriver,
  type APIConnector,
  type AutocompleteResponseState,
  type Filter,
  type RequestState,
  type ResponseState,
  type SearchDriverOptions,
  type SearchState,
} from '@elastic/search-ui';
import { settled, waitUntil } from '@ember/test-helpers';

export interface Park {
  id: string;
  title: string;
  states: string[];
  url: string;
}

const raw = <T>(value: T) => ({ raw: value });

export const PARKS: Park[] = [
  {
    id: '1',
    title: 'Yosemite',
    states: ['California'],
    url: 'https://www.nps.gov/yose',
  },
  {
    id: '2',
    title: 'Yellowstone',
    states: ['Wyoming', 'Montana'],
    url: 'https://www.nps.gov/yell',
  },
  { id: '3', title: 'Zion', states: ['Utah'], url: 'https://www.nps.gov/zion' },
  {
    id: '4',
    title: 'Joshua Tree',
    states: ['California'],
    url: 'https://www.nps.gov/jotr',
  },
  { id: '5', title: 'Acadia', states: ['Maine'], url: 'javascript:alert(1)' },
];

export const toResult = (park: Park) => ({
  id: raw(park.id),
  title: raw(park.title),
  states: raw(park.states),
  nps_link: raw(park.url),
  _meta: { id: park.id, score: 1 },
});

function matchesFilters(park: Park, filters: Filter[] = []) {
  return filters.every(({ field, values, type }) => {
    const fieldValues = ([] as unknown[]).concat(
      park[field as keyof Park] ?? [],
    );
    const hit = (value: unknown) => fieldValues.includes(value);
    return type === 'all' ? values.every(hit) : values.some(hit);
  });
}

function stateFacet(parks: Park[]) {
  const counts = new Map<string, number>();
  parks.forEach((park) =>
    park.states.forEach((state) =>
      counts.set(state, (counts.get(state) ?? 0) + 1),
    ),
  );
  return [
    {
      field: 'states',
      type: 'value',
      data: [...counts].map(([value, count]) => ({ value, count })),
    },
  ];
}

/**
 * In-memory implementation of the search-ui search contract so tests can
 * exercise a real SearchDriver without a network.
 */
export function search(
  requestState: RequestState,
  parks = PARKS,
): ResponseState {
  const {
    searchTerm = '',
    filters,
    current = 1,
    resultsPerPage = 20,
    sortField,
    sortDirection,
  } = requestState;
  const term = searchTerm.toLowerCase();
  let matching = parks.filter(
    (park) =>
      park.title.toLowerCase().includes(term) && matchesFilters(park, filters),
  );

  if (sortField) {
    const key = sortField as keyof Park;
    matching = [...matching].sort((a, b) =>
      String(a[key]).localeCompare(String(b[key])),
    );
    if (sortDirection === 'desc') matching.reverse();
  }

  const start = (current - 1) * resultsPerPage;
  return {
    results: matching.slice(start, start + resultsPerPage).map(toResult),
    totalResults: matching.length,
    totalPages: Math.ceil(matching.length / resultsPerPage),
    facets: {
      states: stateFacet(
        parks.filter(
          (park) => term === '' || park.title.toLowerCase().includes(term),
        ),
      ),
    },
  } as unknown as ResponseState;
}

export function autocomplete(
  requestState: RequestState,
  parks = PARKS,
): AutocompleteResponseState {
  const term = (requestState.searchTerm ?? '').toLowerCase();
  const matching = parks.filter((park) =>
    park.title.toLowerCase().startsWith(term),
  );
  return {
    autocompletedResults: matching.map(toResult),
    autocompletedSuggestions: {
      documents: matching.map((park) => ({
        suggestion: park.title.toLowerCase(),
      })),
    },
  } as unknown as AutocompleteResponseState;
}

export const connector: APIConnector = {
  onSearch: (state) => Promise.resolve(search(state)),
  onAutocomplete: (state) => Promise.resolve(autocomplete(state)),
  onResultClick() {},
  onAutocompleteResultClick() {},
};

export function buildConfig(
  overrides: Partial<SearchDriverOptions> = {},
): SearchDriverOptions {
  return {
    apiConnector: connector,
    trackUrlState: false,
    alwaysSearchOnInitialLoad: true,
    ...overrides,
  };
}

export function createDriver(
  overrides: Partial<SearchDriverOptions> = {},
): SearchDriver {
  return new SearchDriver(buildConfig(overrides));
}

/**
 * Waits until the driver has no in-flight search and Ember has flushed the
 * resulting state updates (WithSearch applies them in `afterRender`).
 */
export async function searchSettled(
  driver: SearchDriver,
  condition: (state: SearchState) => boolean = () => true,
) {
  await waitUntil(
    () => {
      const state = driver.getState();
      return state.wasSearched && !state.isLoading && condition(state);
    },
    { timeout: 2000 },
  );
  await settled();
}
