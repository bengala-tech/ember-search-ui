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

<!-- demo:driver-tree -->

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
| `setQuery(term)`                                                  | Sets the search term (optionally debounced).                         |
| `setSort(list)` / `setPage(n)` / `setPerPage(n)` / `setCursor(c)` | Sort and paging. A filter, query or sort change goes back to page 1. |
| `setExtension(key, value)`                                        | A backend option.                                                    |
| `transaction(fn)`                                                 | Several commands, one search.                                        |
| `import(codec, external)` / `export(codec)`                       | Reads or writes the state in another format.                         |

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
