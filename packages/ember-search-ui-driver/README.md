# ember-search-ui-driver

A framework-agnostic search driver. It keeps one search state, whose filter is
a tree of AND/OR groups, conditions and nested scopes. Every node can be
negated or disabled, and every node has a stable id for UIs to edit. Codecs
(a search API with legacy list and groups formats, URL; Elasticsearch next)
translate that state to and from external filter specs. Moving from a
search-ui driver: see `docs/migrating-from-search-ui.md`.

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

## Using it from a framework

`subscribe` is the only hook a framework needs. The listener gets a new,
immutable snapshot (`{ state, result }`) synchronously after every change;
put it in your reactive layer and render from there. The snapshot keeps its
identity until something changes.

```ts
// Ember: a tracked field
class TrackedSearch {
  @tracked snapshot = driver.snapshot;
  constructor(readonly driver: SearchDriver) {
    driver.subscribe((s) => (this.snapshot = s));
  }
}

// React
const snapshot = useSyncExternalStore(
  (onChange) => driver.subscribe(onChange),
  () => driver.snapshot,
);

// anything with signals (Preact, Solid, Vue refs, Svelte stores...)
const snapshot = signal(driver.snapshot);
driver.subscribe((s) => (snapshot.value = s));
```

`subscribe(listener, { immediate: true })` also calls the listener once with
the current snapshot.

## URL sync (optional)

Nothing touches the URL unless you ask for it:

```ts
import { syncUrl } from 'ember-search-ui-driver';

const stop = syncUrl(driver); // restores from the URL, then keeps it updated
stop(); // disconnects
```

- Only values that differ from the driver's state when sync starts are
  written, so an untouched search keeps a clean URL.
- Filters keep their ids, negation, disabled flags and nesting (`f` holds the
  tree as compact JSON); `q`, `sort`, `page` and `per` stay readable:
  `?q=zion&sort=-visitors,title&page=2`.
- Changes are debounced (`debounceMs`, default 300) and pushed as history
  entries (`history: 'replace'` to rewrite instead); back/forward update the
  driver. Other query parameters are left alone.
- Several searches on one page: `syncUrl(driver, { prefix: 'reports.' })`.
- A broken or hand-edited parameter is ignored (`onInvalid` reports it); the
  rest of the URL still applies.
- It hooks in through `subscribe` like any other integration. To use a
  framework router instead of `window.history`, pass an `adapter`
  (`{ read, write, listen }`); `memoryHistory()` works outside the browser.
- The codec on its own: `urlCodec().serialize(state)` / `.parse(search)`.

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
