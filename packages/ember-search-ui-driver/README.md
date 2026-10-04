# ember-search-ui-driver

A framework-agnostic search driver. It keeps one search state, whose filter is
a tree of AND/OR groups, conditions and nested scopes. Every node can be
negated or disabled, and every node has a stable id for UIs to edit. Codecs
(coming next: Prysmex, Elasticsearch, search-ui, URL) translate that state to
and from external filter specs.

See the design doc for the full model and the codec contract.

## Example

```ts
import {
  SearchDriver,
  memoryBackend,
  and,
  or,
  eq,
  not,
  nested,
} from 'ember-search-ui-driver';

const driver = new SearchDriver({ backend: memoryBackend(docs) });

// (x is b and u is k) or (t is k and x is c)
driver.add(
  'root',
  or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
);

// or build it up node by node, e.g. from a query builder UI
const either = driver.add('root', or());
const first = driver.add(either, and());
driver.add(first, eq('x', 'b'));

// edit any node by id
driver.toggleNegate(first);
driver.toggleDisabled(first);

// "a requirement that is a permit AND failed" (same item), vs. a dotted path
driver.add(
  'root',
  nested('requirements', and(eq('kind', 'permit'), eq('status', 'fail'))),
);

await driver.settled();
driver.result; // { status, results, total, pageCount, aggregations, warnings }
```

## Semantics

- A disabled node, or an incomplete condition, has no effect.
- A group with no active children has no effect; an empty root matches everything.
- `negate` inverts a node; on a group it is NOT (the whole group).
- Paths fan out over arrays (any value matches); `nested` scopes conditions to
  one list item, with `some`, `every` (true for an empty list) or `none`.
- Date values are explicit: `date('2024-01-01')`, `dateMath('now/M')`.

## Development

```sh
pnpm test        # vitest, includes property-based tests of the rewrites
pnpm lint
pnpm build
```
