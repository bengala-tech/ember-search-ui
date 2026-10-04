---
order: 3
imports:
  - import FilterBarDemo from 'docs/demos/filter-bar';
---

# Properties

A Property describes one field of your records once: how to read it, filter
it, sort it, link it and export it. Every view reads the same properties
over the same driver. Views never fetch and never name a field, so a new
view or a new field is one change, not many.

## Why fields, not smart views

Many libraries build smart views: a table that fetches, pages and filters,
with columns that know the query. Each new view (a calendar, a map) repeats
that work, and the filters stay tied to the table.

Properties turn it around. The driver owns the state and the requests,
properties describe the fields, and views are lenses on the same search:

- **A new view touches no field.** A kanban next to the table reads the same
  properties.
- **A new field shows up everywhere.** Defined once, it appears in the
  filters, every view and the export.
- **A new backend touches no view.** Only the codec changes.

## Defining a property

```ts
import { defineProperty } from 'ember-search-ui-driver';

const project = defineProperty<Inspection, string>({
  key: 'project',
  label: 'Project',
  field: { path: 'project.id', type: 'keyword' }, // what filters use
  value: (row) => row.project.name, // what views show
  sort: { path: 'project.name' },
  link: (row) => ({ route: 'projects.show', models: [row.project.id] }),
  views: { table: { width: 200 } },
});
```

A property has layers. Only `label` and `field` are required:

| Layer    | Holds                                                                            | Default                   |
| -------- | -------------------------------------------------------------------------------- | ------------------------- |
| `key`    | A stable id (filter node ids, view config, URLs).                                | `field.path`              |
| `field`  | Query semantics: `path`, `type`, `operators`, `options`, nested `fields`.        | required                  |
| `value`  | The display read.                                                                | the value at `field.path` |
| `sort`   | `false`, or the path to sort on.                                                 | `field.path`              |
| `filter` | `false`, or operators, an editor, a chip, an options source, an in-memory match. | filterable                |
| `views`  | Config for each view, by view name.                                              | none                      |
| `link`   | A URL, a URL with a target, or a route, per record.                              | none                      |
| `export` | `false`, or the exported value and title.                                        | the display value         |
| `meta`   | Your own data; the library never reads it.                                       | none                      |

`defineProperty` fills the defaults and returns a frozen copy.

## Builders

Fields of one kind share a builder; each list overrides what differs.
`extendProperty` merges overrides deeply and keeps everything else:

```ts
const userProperty = (path: string, label: string) =>
  defineProperty<Inspection>({
    label,
    field: { path, type: 'keyword', options: users },
    value: (row) => userName(row[path]),
  });

const createdBy = extendProperty(userProperty('created_by_id', 'Created by'), {
  sort: false,
  views: { table: { width: 160 } },
});
```

## Per-view config

Each view reads its own key under `views`, and declares it, so config is
typed without the core knowing every view:

```ts
declare module 'ember-search-ui-driver' {
  interface PropertyViews {
    table?: { hidden?: boolean; numeric?: boolean };
    calendar?: { date: true };
  }
}
```

## Using properties

These example properties drive the filter bar, the chips and the table
below. State is written in the [legacy shape](/guides/legacy-properties),
with its own legacy picker; it runs unchanged next to the others.

<div class="demo" data-test-demo="filter-bar">
  <FilterBarDemo />
</div>

The helpers views use:

| Helper                                                 | Returns                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `propertyValue(property, row)`                         | The display value.                                          |
| `sortPath(property)`                                   | The path to sort on, or undefined.                          |
| `exportValue(property, row)`                           | The exported value.                                         |
| `operatorsFor(property)` / `defaultOperator(property)` | The operators a filter UI offers.                           |
| `optionsFor(property)`                                 | The picker's options source.                                |
| `schemaFrom(properties)`                               | The driver's field schema, for codecs and the QueryBuilder. |
| `findProperty(properties, keyOrPath)`                  | One property.                                               |
| `isSortable` / `isFilterable` / `isExportable`         | The flags.                                                  |

All of them take properties in either shape.
