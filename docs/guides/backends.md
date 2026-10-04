---
order: 6
---

# Backends and codecs

A backend turns the search state into results: a **codec** writes the
request, `search` sends it, and `normalize` reads the response. The driver
never knows which API it talks to.

```ts
interface Backend<Request, Response, Doc> {
  codec: { serialize(state, ctx): Request; parse?(request, ctx): SearchState };
  search(request: Request, signal: AbortSignal): Promise<Response>;
  normalize(
    response: Response,
    state,
  ): { results: Doc[]; total: number; pageCount?: number };
}
```

## In memory

`memoryBackend(records, options)` searches an array with the driver's own
semantics: for prototypes, tests and offline lists.

```ts
memoryBackend(records, {
  searchFields: ['title', 'description'],
  get, // read paths through Ember's get (records behind proxies)
  match: propertyMatcher(properties), // each property's filter.local
});
```

## A JSON search API

`searchApiBackend` sends `{ search, sort, sort_direction, page, per, filters }`
to an endpoint and reads `{ data, meta: { total_count, total_pages } }`. Two
filter formats:

| Format           | Sends                                                    | Can express              |
| ---------------- | -------------------------------------------------------- | ------------------------ |
| `list` (default) | `[{ field, values }]`, ANDed                             | One condition per field. |
| `groups`         | `{ type: 'any' \| 'all', filters, __negate, __disable }` | OR groups, NOT, on/off.  |

```ts
searchApiBackend({
  filters: 'groups',
  request: (request, signal) =>
    fetch('/api/inspections/search', {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    }).then((response) => response.json()),
});
```

A tree the format cannot express is refused with `UnsupportedNodeError`
instead of being sent wrong; `codec.supports(node, ctx)` tells a UI in
advance. `serializeValue` / `parseValue` convert single values, and
extensions prefixed `api.` (`api.include`) become request keys.

## Path maps

Properties use your app's names for fields; a backend may use others. A path
map renames them in the codec, so properties never know the backend:

```ts
searchApiBackend({
  request,
  paths: (path) => path.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
  parsePaths: (path) => path.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
  sortPaths: { 'project.name': 'project.name.raw' },
});
```

`withPaths(codec, { paths })` wraps any other codec the same way.

## Your own backend

Any API fits: write a codec for its request shape, send it, and normalize
its response. Test the codec on its own: `codec.serialize(createState({ ... }), ctx)`.
