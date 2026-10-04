---
order: 5
imports:
  - import KanbanDemo from 'docs/demos/kanban';
---

# Building views

A view is a component over the search and the properties. Three rules keep
views interchangeable:

1. **Read the properties, never field names.** Columns, cards, calendar
   dates and kanban lanes all come from properties.
2. **Change the search only through driver commands.** Sorting is
   `setSort`, paging is `setPage`; a view never fetches.
3. **Own your conditions.** A view that narrows the search (a calendar's
   month, a map's bounds) adds its own condition with an id like
   `view:calendar`. It leaves the user's filters alone and goes away with the
   view. The QueryBuilder and the filter bar ignore it.

## A table

```gts
import {
  isSortable,
  propertyValue,
  sortPath,
  toProperties,
} from 'ember-search-ui-driver';

const columns = (properties) =>
  toProperties(properties).filter((p) => !p.views?.table?.hidden);
const cell = (property, row) => propertyValue(property, row);

<template>
  <table>
    <thead><tr>
        {{#each (columns @properties) as |column|}}
          <th>{{column.label}}</th>
        {{/each}}
      </tr></thead>
    <tbody>
      {{#each @search.results as |row|}}
        <tr>
          {{#each (columns @properties) as |column|}}
            <td>{{cell column row}}</td>
          {{/each}}
        </tr>
      {{/each}}
    </tbody>
  </table>
</template>
```

Sorting a column is `search.driver.setSort([{ field: sortPath(column), direction }])`,
offered only when `isSortable(column)`.

## A kanban board

The lanes are the options of a grouping property and the card titles come
from the property marked as the title. Filter it with the bar: the lanes
follow.

<div class="demo" data-test-demo="kanban">
  <KanbanDemo />
</div>

## Conditions a view owns

A calendar shows one month. It adds a range condition on its date property,
from a modifier so the change happens after rendering, and removes it when
it leaves:

```ts
const ownsMonth = modifier((element, [calendar]) => {
  calendar.attach(); // add or update `view:calendar`, page size 100
  return () => calendar.detach(); // remove it, restore the page size
});
```

The [properties example](/examples/properties) has the full table, card
list, calendar and CSV export, all reading one property list.
