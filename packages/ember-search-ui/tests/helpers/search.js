import { SearchDriver } from '@elastic/search-ui';
import { settled, waitUntil } from '@ember/test-helpers';

const raw = (value) => ({ raw: value });

export const PARKS = [
  { id: '1', title: 'Yosemite', states: ['California'], url: 'https://www.nps.gov/yose' },
  { id: '2', title: 'Yellowstone', states: ['Wyoming', 'Montana'], url: 'https://www.nps.gov/yell' },
  { id: '3', title: 'Zion', states: ['Utah'], url: 'https://www.nps.gov/zion' },
  { id: '4', title: 'Joshua Tree', states: ['California'], url: 'https://www.nps.gov/jotr' },
  { id: '5', title: 'Acadia', states: ['Maine'], url: 'javascript:alert(1)' },
];

export const toResult = (park) => ({
  id: raw(park.id),
  title: raw(park.title),
  states: raw(park.states),
  nps_link: raw(park.url),
  _meta: { score: 1 },
});

function matchesFilters(park, filters = []) {
  return filters.every(({ field, values, type }) => {
    let fieldValues = [].concat(park[field] ?? []);
    let hit = (value) => fieldValues.includes(value);
    return type === 'all' ? values.every(hit) : values.some(hit);
  });
}

function stateFacet(parks) {
  let counts = new Map();
  parks.forEach((park) =>
    park.states.forEach((state) => counts.set(state, (counts.get(state) ?? 0) + 1))
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
 * In-memory implementation of the search-ui `onSearch` contract so tests can
 * exercise a real SearchDriver without a network.
 */
export function search(requestState, parks = PARKS) {
  let { searchTerm = '', filters, current = 1, resultsPerPage = 20, sortField, sortDirection } =
    requestState;
  let term = searchTerm.toLowerCase();
  let matching = parks.filter(
    (park) => park.title.toLowerCase().includes(term) && matchesFilters(park, filters)
  );

  if (sortField) {
    matching = [...matching].sort((a, b) => String(a[sortField]).localeCompare(String(b[sortField])));
    if (sortDirection === 'desc') matching.reverse();
  }

  let start = (current - 1) * resultsPerPage;
  return {
    results: matching.slice(start, start + resultsPerPage).map(toResult),
    totalResults: matching.length,
    totalPages: Math.ceil(matching.length / resultsPerPage),
    facets: { states: stateFacet(parks.filter((park) => term === '' || park.title.toLowerCase().includes(term))) },
  };
}

export function autocomplete(requestState, parks = PARKS) {
  let term = (requestState.searchTerm ?? '').toLowerCase();
  let matching = parks.filter((park) => park.title.toLowerCase().startsWith(term));
  return {
    autocompletedResults: matching.map(toResult),
    autocompletedSuggestions: {
      documents: matching.map((park) => ({ suggestion: park.title.toLowerCase() })),
    },
  };
}

export function buildConfig(overrides = {}) {
  return {
    trackUrlState: false,
    alwaysSearchOnInitialLoad: true,
    onSearch: async (requestState) => search(requestState),
    onAutocomplete: async (requestState) => autocomplete(requestState),
    ...overrides,
  };
}

export function createDriver(overrides = {}) {
  return new SearchDriver(buildConfig(overrides));
}

/**
 * Waits until the driver has no in-flight search and Ember has flushed the
 * resulting state updates (WithSearch applies them in `afterRender`).
 */
export async function searchSettled(driver, condition = () => true) {
  await waitUntil(
    () => {
      let state = driver.getState();
      return state.wasSearched && !state.isLoading && condition(state);
    },
    { timeout: 2000 }
  );
  await settled();
}
