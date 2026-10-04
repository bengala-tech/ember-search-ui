# Using the driver in Prysmex

Prysmex's search lists all create their driver in one place:
`ServerSearchDriverResource` → `SearchDriverServerHelper` → a search-ui
`ServerSearchDriver` with a `ServerConnector`. Swapping the driver there is
enough; components keep the search-ui API through `searchUiCompat`.

## What maps to what

| Prysmex today                                                                          | New driver                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `ServerSearchDriver` + `ServerConnector`                                               | `new SearchDriver({ backend: prysmexBackend(...) })`                            |
| `adaptRequest` (search, sort, sort_direction, page, per, filters, include)             | `prysmexCodec` (same request shape)                                             |
| `serializeFilters` / `deserializeFilters` (document adapters, query-param serializers) | `serializeValue` / `parseValue` hooks, called per value like today              |
| `client.request` + `afterSearchCall` (store `pushPayload`)                             | `prysmexBackend({ request })`                                                   |
| `meta.total_count` / `meta.total_pages`                                                | `result.total` / `result.pageCount`; other `meta` keys in `result.aggregations` |
| `include`                                                                              | the `prysmex.include` extension                                                 |
| `driver.getState()`, `actions.*`, `subscribeToStateChanges`, `tearDown`                | `searchUiCompat(driver)` (same API)                                             |
| `onSearchStateChange(state)` → controller `query` param                                | `compat.onRequestStateChange(...)`, same shape, request changes only            |
| `setupInitialSearchState(query)`                                                       | `fromSearchUiState(query, defaults)`                                            |
| `getSerializedState()`                                                                 | `driver.export(codec)`                                                          |
| `makeSearch(state)` (exports)                                                          | `request(driver.export(codec))` with your client                                |

## Sketch of `SearchDriverServerHelper` on the new driver

```ts
import {
  SearchDriver,
  createState,
  fromSearchUiState,
  prysmexBackend,
  prysmexCodec,
  searchUiCompat,
} from 'ember-search-ui-driver';

const valueHooks = {
  // the existing per-value logic of serializeFilters / deserializeFilters
  serializeValue: (field: string, value: unknown) => serializeOne(field, value),
  parseValue: (field: string, value: unknown) => deserializeOne(field, value),
};

const driver = new SearchDriver({
  backend: prysmexBackend({
    filters: 'list', // what the backend receives today
    ...valueHooks,
    request: async (request, signal) => {
      const response = await this.fetchRequest.request(this.endpoint, {
        method: this.requestMethod,
        body: request,
        signal,
      });
      if (this.useEmberData)
        response.results = this.store.pushPayload(response);
      return response;
    },
  }),
  initialState: fromSearchUiState(
    this.initialSearchState ?? {},
    createState({
      page: { kind: 'offset', page: 1, perPage: 10 },
      extensions: { 'prysmex.include': this.include },
    }),
  ),
  debounceMs: 0,
});

// what the components get, unchanged API
this.driver = searchUiCompat(driver);

// keep the controller's `query` param in sync, as onSearchStateChange did:
// called with { current, resultsPerPage, searchTerm, sortField, sortDirection, filters }
// on request changes only (not when results arrive)
this.driver.onRequestStateChange((state) => this.onSearchStateChange?.(state));
```

Notes:

- `filters: 'list'` sends exactly the old `filters` list, so the backend sees
  no difference. The list can only AND per-field conditions, which is all the
  current UI builds; anything else is refused with `UnsupportedNodeError`.
- `filters: 'groups'` sends the documented spec (`type: any/all`, `__negate`,
  `__disable`) and enables OR groups and negation, e.g. from `QueryBuilder`.
  Nested (per-item) queries are not mapped yet: their Prysmex syntax is the
  open question.
- Old URLs keep working: `fromSearchUiState` reads the existing `query` param
  shape, and the codec's `parse` reads both filter formats.
- Offline lists (`LocalSearchDriverResource`) can use `memoryBackend(records)`
  with the same compat wrapper.
