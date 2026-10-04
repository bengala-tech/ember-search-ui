---
order: 4
imports:
  - import FilterBarDemo from 'docs/demos/filter-bar';
  - import QueryBuilderDemo from 'docs/demos/query-builder';
---

# Filtering UIs

Three ready components cover most filter UIs. They all edit the same filter
tree, so they can sit side by side.

## FilterBar and FilterChips

One filter per property, combined with AND: what most lists need.

```gts
import { FilterBar, FilterChips } from 'ember-search-ui-views';

<template>
  <FilterBar @search={{search}} @properties={{properties}} />
  <FilterChips @search={{search}} @properties={{properties}} />
</template>
```

Each property is edited by its own editor, its legacy filter component, or a
built-in editor chosen from the field type. Chips show each set filter with
the property's chip component, or in words.

<div class="demo" data-test-demo="filter-bar">
  <FilterBarDemo />
</div>

A filter bar keeps its conditions directly under the root with the id
`filter:<key>`. That is the same node `setFilter(field, value)` edits in the
search-ui compatible API, so legacy code and the bar never disagree.

## QueryBuilder

The whole tree: conditions, AND/OR groups nested to any depth, NOT and
on/off on every row and group, and conditions on items of nested lists.

```gts
<QueryBuilder @search={{search}} @properties={{properties}} />
```

With `@properties`, it offers the filterable fields, and a property's editor
edits its rows. Conditions owned by a view (`view:calendar`) are not shown.

<div class="demo" data-test-demo="query-builder">
  <QueryBuilderDemo />
</div>

The last three presets filter lists inside records: each
inspection has a list of `checks`, and a nested scope says whether **some**,
**every** or **none** of them must match. Conditions inside one scope hold
for the same item, which flat conditions cannot express. A property over a
list is declared with `nested: true` and the fields of each item:

```ts
const checks = defineProperty<Inspection>({
  label: 'Checks',
  field: { path: 'checks', type: 'object', nested: true, fields: CHECK_FIELDS },
});
```

The FilterBar leaves such properties out (one condition cannot scope a
list); the QueryBuilder offers them as nested scopes. The groups request has
no form for nested queries yet, so these presets run against the in-memory
backend only.

### From a UI to code

**Show query → Code** prints the current tree as the builder calls that make
it, ready to paste into an app. The same comes from `filterToCode`:

```ts
import { filterToCode } from 'ember-search-ui-driver';

filterToCode(driver.state.filter, { imports: true });
// import { and, eq, nested } from 'ember-search-ui-driver';
//
// and(nested('checks', and(eq('result', 'fail'), eq('item', 'gas lines'))))
```

Generated ids and node `meta` are left out; ids with a colon
(`filter:state`) are kept as `withId(...)`, since UIs find nodes by them.
Every demo also keeps its search in the URL under its own prefix, so
**Show query** offers a link to the exact search on screen.

## One property's filter

To build your own filter UI, render one property at a time:

```gts
import { PropertyFilter, PropertyChip } from 'ember-search-ui';

<template>
  <PropertyFilter @search={{search}} @property={{state}} />
  <PropertyChip @search={{search}} @property={{state}} />
</template>
```

`PropertyFilter` renders the property's editor on its `filter:<key>`
condition; without one it yields `{ property, node, update, remove }` so the
block can build one.

## Writing an editor

An editor edits one condition. It gets the property, the current node
(undefined until something is set), and two callbacks:

```gts
import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { FilterEditorSignature } from 'ember-search-ui';

const highScores = { operator: 'range', value: { gte: 50 } } as const;

const ScoreEditor: TOC<FilterEditorSignature> = <template>
  <button type="button" {{on "click" (fn @update highScores)}}>High scores</button>
  <button type="button" {{on "click" @remove}}>Any score</button>
</template>;

const score = defineProperty({
  label: 'Score',
  field: { path: 'score', type: 'number' },
  filter: { editor: ScoreEditor },
});
```

The same editor works in the filter bar, in `PropertyFilter` and in the
QueryBuilder's rows: each passes the node it edits.
