# Query builder example: one filter tree, legacy and new formats

Every page runs the same driver and keeps the same internal state, a filter
tree of groups and conditions. Only the serialization of the request differs.

| Page                | UI                                                                                                                                        | Sends                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `/legacy`           | a legacy filter UI (one filter per property, AND only), driven through `searchUiCompat`                                                   | the legacy `filters` list: `[{ field, values }]`          |
| `/groups`           | `QueryBuilder`: nested any/all groups, NOT and on/off on every row and group                                                              | the groups spec: `{ type, filters, __negate, __disable }` |
| `/templates/legacy` | a list template written for a search-ui driver (`WithSearch`, containers, an Excel export, a `query` param), unchanged, on `serverSearch` | the legacy list                                           |
| `/templates/groups` | the same list with `<Search>` and a `QueryBuilder`, next to an unchanged `WithSearch` view                                                | the groups spec                                           |

A fake server (`app/demo/fake-server.ts`) receives only the JSON request,
decodes it with the codec's server side, and answers with `data` and `meta`
totals. The `/legacy` and `/groups` pages show the internal tree, the exact
request sent, and the same state serialized in the other format. When the
legacy list cannot express a tree (OR groups, NOT), the page says why instead
of guessing.

The template pages show the code to copy: `app/example/` (the controller
base and the client), `app/controllers/*-template.ts` and
`app/templates/*-template.gts`.

## Run it

```sh
pnpm install            # from the repository root
pnpm build              # builds the packages the app uses
cd examples/query-builder
pnpm start              # http://localhost:5173
pnpm test               # acceptance tests for every page
```

The acceptance tests drive the UIs and check, for each scenario: the exact
JSON the server received, the result count against a ground truth computed
directly from the data, and that the other format either gives the same
results or is refused with the reason.
