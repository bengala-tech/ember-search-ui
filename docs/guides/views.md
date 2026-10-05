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
3. **Narrow with a scope.** A view that narrows the search (a calendar's
   month, a map's bounds) sets a scope: `driver.setScope('calendar', node)`.
   Every search is ANDed with it, but it is not in the filter tree, so the
   QueryBuilder, the filter bar and the URL never see it.

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

## Scopes

A calendar shows one month. It scopes the search to a range on its date
property, from a modifier so the change happens after rendering, and removes
the scope when it leaves:

```ts
driver.setScope('calendar', range('due_at', { gte: date(from), lt: date(to) }));
driver.setScope('calendar', undefined); // gone
```

```ts
const ownsMonth = modifier((element, [calendar]) => {
  calendar.attach(); // set the month's scope, page size 100
  return () => calendar.detach(); // remove it, restore the page size
});
```

The [properties example](/examples/properties) has the full table, card
list, calendar and CSV export, all reading one property list.
