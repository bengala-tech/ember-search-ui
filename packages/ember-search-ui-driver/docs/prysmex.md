# Using the driver in Prysmex

Prysmex's server search lists all create their driver in one place:
`ServerSearchDriverResource` → `SearchDriverServerHelper` → a search-ui
`ServerSearchDriver` with a `ServerConnector`. `prysmexServerSearch` builds
the new driver behind the same API (search-ui's plus `apiConnector`,
`getSerializedState` and `makeSearch`), so replacing the driver there is the
only change for those lists. Offline lists (`LocalSearchDriverResource`) are
not covered yet; they keep the old local driver.

## What maps to what

| Prysmex today                                                                          | New driver                                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `new ServerSearchDriver({ apiConnector: new ServerConnector(...) })`                   | `prysmexServerSearch({ endpoint, send, ... })`                                  |
| `adaptRequest` (search, sort, sort_direction, page, per, filters, include)             | `prysmexCodec` (same request shape)                                             |
| `serializeFilters` / `deserializeFilters` (document adapters, query-param serializers) | `serializeValue` / `parseValue` hooks, called per value like today              |
| `client.request(endpoint, query, opts)`                                                | `send(endpoint, request, extra)`; searches pass `{ signal }` in `extra`         |
| `afterSearchCall` (store `pushPayload`, page cap)                                      | `afterSearch(response)`, searches only                                          |
| `beforeSearchCall` → `onSearchStateChange(serializedState)` → `query` param            | `driver.onSerializedStateChange(...)`, on request changes only                  |
| `setupInitialSearchState(query)`                                                       | `initialState: query` (`parseValue` reads the values back)                      |
| `meta.total_count` / `meta.total_pages`                                                | `result.total` / `result.pageCount`; other `meta` keys in `result.aggregations` |
| `driver.getState()`, `actions.*`, `driver.setFilter(...)`, `subscribeToStateChanges`   | the same, on the returned object                                                |
| `apiConnector.serializeState` / `prepareRequest` / `makeSearch` / `endpoint`           | the same                                                                        |
| `driver.getSerializedState()` / `driver.makeSearch(state, extra)`                      | the same                                                                        |
| `setFilter(field, { gte: Date, lte: Date })` (calendar), moment values                 | accepted: sent as ISO strings, like `JSON.stringify` sent them                  |
| filter values of any other shape                                                       | kept and sent as they are (the `raw` operator)                                  |

## Sketch of `SearchDriverServerHelper` on the new driver

```ts
import { prysmexServerSearch } from 'ember-search-ui-driver';

createSearchDriver(query: RequestState = {}) {
  const driver = prysmexServerSearch({
    endpoint: this.endpoint,
    include: this.include,
    filters: 'list', // what the backend receives today
    // the existing per-value logic of serializeFilters / deserializeFilters
    serializeValue: (field, value) => serializeOne(field, value),
    parseValue: (field, value) => deserializeOne(field, value),
    schema, // field types: a string on a text field means "contains"
    initialState: this.setupInitialSearchState(query), // minus deserializeFilters
    send: (endpoint, request, extra) => this.onSearch(endpoint, request, extra),
    afterSearch: (response) => {
      if (this.useEmberData) response.results = this.store.pushPayload(response);
      // ...cap total_pages for limited clients, as today
      return response;
    },
  });
  // keeps the controller's `query` param in sync, as beforeSearchCall did
  driver.onSerializedStateChange((state) => this.onSearchStateChange?.(state));
  return driver;
}
```

Notes:

- `filters: 'list'` sends exactly the old `filters` list, so the backend sees
  no difference. The list can only AND per-field conditions, which is all the
  current UI builds; anything else is refused with `UnsupportedNodeError`.
- `filters: 'groups'` sends the documented spec (`type: any/all`, `__negate`,
  `__disable`) and enables OR groups and negation, e.g. from `QueryBuilder`.
  Nested (per-item) queries are not mapped yet: their Prysmex syntax is the
  open question.
- Give the driver a field schema (types per field, e.g. derived from the
  schema templates). Prysmex reads a bare string as "contains" on text fields
  and "equals" elsewhere; with the schema, `setFilter` on a text field becomes
  `contains` and the codec refuses an `equals` it could not express.
- Old URLs keep working: `fromSearchUiState` reads the existing `query` param
  shape, and the codec's `parse` reads both filter formats.
- Types: Prysmex code is typed against `ServerSearchDriver`. The returned
  object has the same members, but TypeScript sees a different class, so the
  helper's `driver` type and a few casts change.
- `onSerializedStateChange` fires when the request changes. The old hook
  fired before every search, including repeats of the same request.
- Offline lists (`LocalSearchDriverResource`, with per-property filter
  functions) are not covered yet. `memoryBackend(records)` with
  `searchUiCompat` is the starting point, but the property filters need a
  port.
