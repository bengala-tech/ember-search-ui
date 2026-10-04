# ember-search-ui docs site

The documentation site for the three packages: guides with live demos, an
API reference, and full examples. It is an Ember app in the workspace, so
every example on the site is a real, tested component.

| Path            | What it is                                                 |
| --------------- | ---------------------------------------------------------- |
| `/`             | Home                                                       |
| `/guides/:slug` | Guides (`app/guides/*.md`), with live demos (`app/demos/`) |
| `/api`          | The API reference (`app/api/reference.ts`)                 |
| `/examples`     | Full examples, listed below                                |

## Writing guides

Guides are Markdown files in `app/guides/`, listed in reading order in
`app/guides/index.ts`. A small Vite plugin (`markdown.mjs`) renders them at
build time: headings get ids, the page gets a table of contents, and a
`<!-- demo:name -->` comment marks where the page renders a live demo from
the guide's `demos` map. Links to `/...` navigate inside the app.

The migration guide is the driver package's own
`docs/migrating-from-search-ui.md`, so it has one source.

## The API reference

`app/api/reference.ts` lists every export with one line. A unit test compares
it with each package's runtime exports both ways: a new export without an
entry, or an entry for a removed export, fails the tests.

## Examples

| Page                         | UI                                                                                                                                               | Sends                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `/examples/legacy`           | a legacy filter UI (one filter per property, AND only), driven through `searchUiCompat`                                                          | the legacy `filters` list: `[{ field, values }]`          |
| `/examples/groups`           | `QueryBuilder`: nested any/all groups, NOT and on/off on every row and group                                                                     | the groups spec: `{ type, filters, __negate, __disable }` |
| `/examples/templates/legacy` | a list template written for a search-ui driver (`WithSearch`, containers, an Excel export, a `query` param), unchanged, on `serverSearch`        | the legacy list                                           |
| `/examples/templates/groups` | the same list with `<Search>` and a `QueryBuilder`, next to an unchanged `WithSearch` view                                                       | the groups spec                                           |
| `/examples/properties`       | one property list (new and legacy shapes) driving a filter bar, chips, the QueryBuilder, a table, a card list, a month calendar and a CSV export | the groups spec                                           |

A fake server (`app/demo/fake-server.ts`) receives only the JSON request,
decodes it with the codec's server side, and answers with `data` and `meta`
totals. The legacy and groups pages show the internal tree, the exact request
sent, and the same state serialized in the other format.

## Run it

```sh
pnpm install            # from the repository root
pnpm build              # builds the packages the site uses
cd docs
pnpm start              # http://localhost:5173
pnpm test               # guides, demos, API reference and examples
```

The tests drive every page and check each scenario against a ground truth
computed directly from the data.
