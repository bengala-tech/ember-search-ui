---
order: 2
imports:
  - import DriverTree from 'docs/demos/driver-tree';
---

# The driver

`SearchDriver` owns one search state, changes it only through commands, and
runs one search per settled change through its backend. It has no framework
code: anything that can subscribe can render it.

## The search state

| Part         | Holds                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| `query`      | The search term (`query.term`) and, optionally, the fields it searches.  |
| `filter`     | A tree of groups and conditions; the root is a group with the id `root`. |
| `sort`       | A list of `{ field, direction }`.                                        |
| `page`       | `{ kind: 'offset', page, perPage }` or a cursor.                         |
| `extensions` | Backend-specific options, namespaced: `api.include`.                     |

## The filter tree

Filters are nodes. A **condition** tests a field with an operator (`eq`,
`in`, `all`, `range`, `exists`, `contains`, `prefix`). A **group** combines
its children with AND or OR. A **nested** node scopes a filter to the items
of a list, so "a check that is a permit AND failed" means the same item.
Every node has an id, and can be negated or disabled.

Builders make the tree readable:

```ts
import {
  and,
  or,
  not,
  eq,
  anyOf,
  range,
  nested,
  date,
} from 'ember-search-ui-driver';

driver.add(
  'root',
  or(
    eq('state', 'done'),
    and(eq('priority', 'high'), eq('project', 'Monterrey plant')),
  ),
);

driver.add('root', not(anyOf('tags', ['fire', 'safety'])));
driver.add('root', range('created_at', { gte: date('2026-03-01') }));
driver.add(
  'root',
  nested('checks', and(eq('kind', 'permit'), eq('status', 'fail'))),
);
```

Try it: add the group, then negate it or switch it off.

<div class="demo" data-test-demo="driver-tree">
  <DriverTree />
</div>

**What a node means when it has no effect.** A disabled node, a condition
with an incomplete value, and a group with no active children are skipped
by their parent, even when negated or inside an OR. An empty root matches
everything. So a half-filled row in a UI never empties the results.

## Commands

Every change is a command, and every command is a bound function, so it can
be passed around as a callback:

| Command                                                           | Does                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| `add(parentId, node, index?)`                                     | Inserts a node; returns its id.                                      |
| `update(id, patch)` / `remove(id)` / `move(id, parentId, index?)` | Edits a node.                                                        |
| `toggleNegate(id)` / `toggleDisabled(id)`                         | Flips a flag.                                                        |
| `replaceFilter(group)` / `clearFilter()`                          | Replaces or empties the tree.                                        |
| `setScope(name, node)`                                            | Narrows every search, outside the tree (`undefined` removes it).     |
| `setQuery(term)`                                                  | Sets the search term (optionally debounced).                         |
| `setSort(list)` / `setPage(n)` / `setPerPage(n)` / `setCursor(c)` | Sort and paging. A filter, query or sort change goes back to page 1. |
| `setExtension(key, value)`                                        | A backend option.                                                    |
| `transaction(fn)`                                                 | Several commands, one search.                                        |
| `import(codec, external)` / `export(codec)`                       | Reads or writes the state in another format.                         |

## Scopes

Sometimes the app narrows the search, not the user. Think of a toy shop
with tabs:

- **All toys**
- **For babies**: age 2 or younger
- **On sale**: sale price is set

The tab is a scope. Every search is ANDed with it:

```ts
const TABS = {
  all: undefined,
  babies: range('age', { lte: 2 }),
  sale: exists('salePrice'),
};

function changeTab(tab: keyof typeof TABS) {
  driver.setScope('tab', TABS[tab]); // undefined removes it
}
```

The user can still filter (`color is red`) on any tab. A scope is kept out
of the filter tree on purpose:

- **The user can't break it.** It isn't a row in the QueryBuilder or a chip
  in the filter bar, so nobody deletes "age 2 or younger" by mistake, and
  `clearFilter()` keeps it.
- **It doesn't mix with the user's filters.** The user can filter `age`
  too; the tab and the user each have their own condition, and both apply.
- **It stays out of the URL and `export`.** The tab already lives in the
  app's own route or query param; a link holds just what the user chose.

A view that narrows the search, like a calendar's month, uses a scope the
same way (see [Views](/guides/views)).

## Results

`driver.result` holds `status` (`idle`, `loading`, `success` or `error`),
`results`, `total`, `pageCount`, `aggregations` and `warnings`. A newer
search aborts an older one, and an error is kept as state instead of thrown.
`await driver.settled()` resolves once nothing is scheduled or running.

## Subscribing

`subscribe` is the only hook a framework needs. The listener gets a new,
immutable snapshot (`{ state, result }`) after every change:

```ts
const stop = driver.subscribe((snapshot) => render(snapshot));
```

In Ember, `<Search>` and `trackSearch(owner, driver)` do this for you: they
keep the snapshot in a tracked property and register test waiters, so
`await settled()` in tests waits for searches.

## The URL

Nothing touches the URL unless you ask. `syncUrl(driver)` restores the state
from the URL and keeps it updated (debounced, back and forward included); in
Ember, pass `@syncUrl={{true}}` to `<Search>`.

```ts
const stop = syncUrl(driver, { prefix: 'reports.' });
```

Only the parts that differ from the starting state are written, so an
untouched search keeps a clean URL. Filters keep their ids, flags and nesting.
