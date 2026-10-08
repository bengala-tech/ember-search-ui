---
order: 1
imports:
  - import QuickStart from 'docs/demos/quick-start';
---

# Getting started

ember-search-ui has three packages. Use the ones you need:

| Package                  | What it gives you                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ember-search-ui-driver` | The search driver, Properties, codecs and backends. No framework code.                                               |
| `ember-search-ui`        | Ember integration: `<Search>`, `TrackedSearch`, property filter components, and the search-ui compatible components. |
| `ember-search-ui-views`  | Ready views: `FilterBar`, `FilterChips`, `QueryBuilder`, and the classic facet, paging and result views.             |

```sh
pnpm add ember-search-ui-driver ember-search-ui ember-search-ui-views
```

## A first search

A search needs a backend: something that turns the search state into
results. Here it searches an array in memory; a later guide connects a real
API. `<Search>` creates a driver for it and yields a tracked `search`: the
state, the results, and `search.driver` for commands.

```gts
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { memoryBackend } from 'ember-search-ui-driver';
import { Search, type TrackedSearch } from 'ember-search-ui';

const backend = memoryBackend(inspections, {
  searchFields: ['title', 'description', 'project'],
});
const config = {
  backend,
  syncUrl: false, // default; set true to keep the search in the URL
  initialState: { page: { kind: 'offset', page: 1, perPage: 5 } },
};

const setTerm = (search: TrackedSearch, event: Event) =>
  search.driver.setQuery((event.target as HTMLInputElement).value);

<template>
  <Search @config={{config}} as |search|>
    <input type="search" {{on "input" (fn setTerm search)}} />
    <p>{{search.total}} inspections</p>
    <ul>
      {{#each search.results as |inspection|}}
        <li>{{inspection.title}}</li>
      {{/each}}
    </ul>
  </Search>
</template>
```

To share a driver between components or keep it in a service, create it
yourself (`new SearchDriver({ backend })`) and pass `@driver` instead;
`<Search>` then leaves its lifetime to you.

Type below: each keystroke calls `driver.setQuery`, the driver searches, and
the template follows.

<div class="demo" data-test-demo="quick-start">
  <QuickStart />
</div>

## What to read next

- [The driver](/guides/driver): the filter tree (AND/OR groups, NOT, nested
  list conditions), commands, results and URL sync.
- [Properties](/guides/properties): describe your fields once and let every
  view use them.
- [Filtering UIs](/guides/filtering): the filter bar, chips and the query
  builder.
- [Migrating from search-ui](/guides/migrating-from-search-ui): keep your templates and swap
  the driver.
