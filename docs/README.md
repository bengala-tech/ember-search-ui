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

Guides are Markdown files in `guides/`, compiled by
[Docfy](https://github.com/josemarluedke/docfy) (`@docfy/ember-vite`) into
Ember route templates under `/guides/...`, so a page can use components
inline. Import them in the page's front matter, then use them in the text:

```md
---
order: 1
imports:
  - import QuickStart from 'docs/demos/quick-start';
---

<div class="demo">
  <QuickStart />
</div>
```

`order` sets the page's place in the navigation. Code blocks get Shiki
highlighting (Glimmer templates included) and a copy button. The generated
templates (`app/templates/guides/`) are git-ignored. The migration guide is
the driver package's own `docs/migrating-from-search-ui.md` (see
`docfy.config.mjs`), so it has one source.

Every demo has a "Show query" button: a modal with the current search
converted, live, into the internal state, the legacy list request, the
groups request and the URL.

## Deploying

`vercel.json` at the repository root builds the packages and the site and
serves `docs/dist` with every path falling back to the app. From the root:

```sh
npx vercel login
npx vercel --prod
```

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
