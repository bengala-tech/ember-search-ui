# Using the driver in Prysmex

Prysmex's server search lists all create their driver in one place:
`ServerSearchDriverResource` → `SearchDriverServerHelper` → a search-ui
`ServerSearchDriver` with a `ServerConnector`. `prysmexServerSearch` builds
the new driver behind the same API (search-ui's plus `apiConnector`,
`getSerializedState` and `makeSearch`), so replacing the driver there is the
only change for those lists. Offline lists (`LocalSearchDriverResource`) get
the same treatment from `prysmexLocalSearch`; see below.

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

## Offline lists: `prysmexLocalSearch`

`SearchDriverLocalHelper` builds a `LocalSearchDriver` with a
`LocalConnector`. `prysmexLocalSearch` is the same thing on the new driver,
with the connector's search ported as is:

| `LocalConnector` today                                                         | `prysmexLocalSearch`                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `new LocalConnector({ data, properties, usePagination, filteringIgnoreCase })` | the same options                                        |
| `driver.setData(data)`, `setProperties(properties)`, `runSearch()`             | the same; they search again on the current page         |
| search term over `filteredBy` of properties with `useFilter`                   | the same (case-insensitive, booleans and Dates skipped) |
| `property.localFilteringFunction(row, values, { valueKey })` per filter        | the same; filters without a property are ignored        |
| `betterCompare` / Ember `compare` on one sort field                            | `emberLikeCompare` by default, or pass `compare`        |
| Ember `get(row, path)`                                                         | plain access by default; pass `get` for proxies         |
| `resultsPerPage` (20 when unset), `usePagination: false`                       | the same                                                |

```ts
import { get } from '@ember/object';
import { prysmexLocalSearch } from 'ember-search-ui-driver';

createSearchDriver(query: RequestState = {}) {
  return prysmexLocalSearch({
    data: this.data,
    properties: this.properties,
    usePagination: this.usePagination,
    initialState: this.setupInitialSearchState(query),
    get, // belongsTo proxies and computed properties
  });
}
```

The property builders check `searchDriver instanceof LocalSearchDriver` to
pick local paths and filtering functions. Export the new class under the old
name and those checks keep working without edits:

```ts
// @addons/search-ui/addon/connectors/local/index.ts
export { PrysmexLocalCompat as LocalSearchDriver } from 'ember-search-ui-driver';
```

Differences from the old connector:

- A filter of type `none` negates; the old connector ignored the type. The
  Prysmex UI only sends `any`.
- Date and moment filter values reach `localFilteringFunction` as ISO
  strings, not as the objects that were set. `moment(value)` reads both.
- Query-builder nodes next to the search-ui filters are applied too.
- Kept on purpose: the search term matches a missing value as the text
  "null" or "undefined", like `'' + value` did.
