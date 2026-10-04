# Query builder example: one filter tree, two Prysmex formats

Both pages run the same driver and keep the same internal state, a filter
tree of groups and conditions. Only the serialization of the request differs.

| Page      | UI                                                                                                                         | Sends                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/legacy` | Prysmex's current filter UI (one filter per property, AND only), driven through `searchUiCompat` like Prysmex's components | the `filters` list Prysmex sends today: `[{ field, values }]`        |
| `/groups` | `QueryBuilder`: nested any/all groups, NOT and on/off on every row and group                                               | the documented groups spec: `{ type, filters, __negate, __disable }` |

A fake Prysmex server (`app/demo/fake-prysmex.ts`) receives only the JSON
request, decodes it with the codec's server side, and answers with `data` and
`meta` totals. Each page shows the internal tree, the exact request sent, and
the same state serialized in the other format. When the legacy list cannot
express a tree (OR groups, NOT), the page says why instead of guessing.

The state is kept in the URL (`legacy.*` / `groups.*` parameters).

## Run it

```sh
pnpm install            # from the repository root
pnpm build              # builds the packages the app uses
cd examples/query-builder
pnpm start              # http://localhost:5173/legacy and /groups
pnpm test               # acceptance tests for both formats
```

The acceptance tests drive both UIs and check, for each scenario: the exact
JSON the server received, the result count against a ground truth computed
directly from the data, and that the other format either gives the same
results or is refused with the reason.
