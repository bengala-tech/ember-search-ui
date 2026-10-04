# Migrating from a search-ui driver

Many apps built their lists on `@elastic/search-ui`'s `SearchDriver`,
extended with their own connector: a server connector that posts a JSON
request to a search endpoint, or a local connector that filters an array in
memory. The driver package can replace both without touching the templates:

- `serverSearch` returns the new driver behind the search-ui API, plus the
  usual server-connector extras (`apiConnector`, `getSerializedState`,
  `makeSearch`).
- `localSearch` does the same for in-memory lists (`setData`,
  `setProperties`, `runSearch`).

Templates keep using ember-search-ui's `WithSearch`, `mapContextToProps` and
the containers. New UIs can use `<Search>` and the `QueryBuilder` on the
same driver.

## Server lists: `serverSearch`

| search-ui driver + server connector                                          | `serverSearch`                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `new SearchDriver({ apiConnector: new MyServerConnector(...) })`             | `serverSearch({ endpoint, send, ... })`                                         |
| request: `search`, `sort`, `sort_direction`, `page`, `per`, `filters`, ...   | `searchApiCodec` (the same request shape)                                       |
| per-value filter serializers / deserializers                                 | `serializeValue` / `parseValue` hooks, called once per value                    |
| `client.request(endpoint, query, options)`                                   | `send(endpoint, request, extra)`; searches pass `{ signal }` in `extra`         |
| `afterSearchCall` (e.g. `store.pushPayload`)                                 | `afterSearch(response)`, searches only                                          |
| `onSearchStateChange(serializedState)` → a `query` param                     | `driver.onSerializedStateChange(...)`, on request changes only                  |
| restoring the `query` param                                                  | `initialState: query` (`parseValue` reads the values back)                      |
| `meta.total_count` / `meta.total_pages`                                      | `result.total` / `result.pageCount`; other `meta` keys in `result.aggregations` |
| `driver.getState()`, `actions.*`, `driver.setFilter(...)`, subscriptions     | the same, on the returned object                                                |
| `apiConnector.serializeState` / `prepareRequest` / `makeSearch` / `endpoint` | the same                                                                        |
| `driver.getSerializedState()` / `driver.makeSearch(state, extra)`            | the same                                                                        |
| `setFilter(field, { gte: Date, lte: Date })`, moment values                  | accepted: sent as ISO strings, as `JSON.stringify` sent them                    |
| filter values of any other shape                                             | kept and sent as they are (the `raw` operator)                                  |

```ts
import { serverSearch } from 'ember-search-ui-driver';

createSearchDriver(query = {}) {
  const driver = serverSearch({
    endpoint: this.endpoint,
    include: this.include,
    filters: 'list', // the legacy format the backend receives today
    // your per-value serializers, if any
    serializeValue: (field, value) => serializeOne(field, value),
    parseValue: (field, value) => deserializeOne(field, value),
    schema, // field types: a string on a text field means "contains"
    initialState: query, // e.g. the `query` param
    send: (endpoint, request, extra) => this.client.request(endpoint, request, extra),
    afterSearch: (response) => {
      response.results = this.store.pushPayload(response);
      return response;
    },
  });
  // keeps a `query` param in sync, as onSearchStateChange did
  driver.onSerializedStateChange((state) => (this.query = state));
  return driver;
}
```

Notes:

- `filters: 'list'` sends the legacy `filters` list exactly, so the backend
  sees no difference. The list can only AND per-field conditions; anything
  else is refused with `UnsupportedNodeError`.
- `filters: 'groups'` sends the groups spec (`type: any/all`, `__negate`,
  `__disable`) and allows OR groups and negation, e.g. from `QueryBuilder`.
  Nested (per-item) queries are not mapped yet.
- Give the driver a field schema. The API reads a bare string as "contains"
  on text fields and "equals" elsewhere; with the schema, `setFilter` on a
  text field becomes `contains`, and the codec refuses an `equals` it could
  not express.
- Old URLs keep working: `fromSearchUiState` reads the search-ui state
  shape, and the codec's `parse` reads both filter formats.
- Types: code typed against search-ui's `SearchDriver` (or a subclass) sees a
  different class, so those annotations change or need a cast.
- `onSerializedStateChange` fires when the request changes. A
  `beforeSearchCall` hook fired before every search, including repeats of
  the same request.

## In-memory lists: `localSearch`

For a search-ui driver with a local connector (`setData`, `setProperties`,
per-property filtering functions), `localSearch` is the same thing on the
new driver:

| search-ui driver + local connector                                       | `localSearch`                                           |
| ------------------------------------------------------------------------ | ------------------------------------------------------- |
| options `data`, `properties`, `usePagination`, `filteringIgnoreCase`     | the same options                                        |
| `driver.setData(data)`, `setProperties(properties)`, `runSearch()`       | the same; they search again on the current page         |
| search term over the `filteredBy` path of each property with `useFilter` | the same (case-insensitive, booleans and Dates skipped) |
| `property.localFilteringFunction(row, values, { valueKey })` per filter  | the same; filters without a property are ignored        |
| Ember `compare` on one sort field                                        | `emberLikeCompare` by default, or pass `compare`        |
| Ember `get(row, path)`                                                   | plain access by default; pass `get` for proxies         |
| `resultsPerPage` (20 when unset), `usePagination: false`                 | the same                                                |

```ts
import { get } from '@ember/object';
import { localSearch } from 'ember-search-ui-driver';

createSearchDriver(query = {}) {
  return localSearch({
    data: this.data,
    properties: this.properties,
    usePagination: this.usePagination,
    initialState: query,
    get, // belongsTo proxies and computed properties
  });
}
```

If app code checks `driver instanceof LocalSearchDriver`, export the new
class under that name and the checks keep working:

```ts
export { LocalSearchCompat as LocalSearchDriver } from 'ember-search-ui-driver';
```

Differences from a typical local connector:

- A filter of type `none` negates (connectors often ignored the type).
- Date and moment filter values reach `localFilteringFunction` as ISO
  strings, not as the objects that were set. `moment(value)` reads both.
- Query-builder nodes next to the search-ui filters are applied too.
- Kept on purpose: the search term matches a missing value as the text
  "null" or "undefined", as `'' + value` did.

## Seeing both side by side

`examples/query-builder` has a legacy list template running unchanged on
`serverSearch` (`/templates/legacy`), and the same list on the new spec with
`<Search>` and a `QueryBuilder` (`/templates/groups`).
