---
order: 3
imports:
  - import FilterBarDemo from 'docs/demos/filter-bar';
---

# Properties

A Property describes one field of your records once: how to read it, filter
it, sort it, link it and export it. Every view reads the same properties
over the same driver. Views use these definitions to read records and change the driver. The
driver owns search state and requests; a property is configuration, not a
record, a filter condition, or a fetching service.

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
| `key`    | A stable property id for lookup and view config.                                 | `field.path`              |
| `label`  | Human-readable property name.                                                    | required                  |
| `icon`   | Optional icon name for views that support it.                                    | none                      |
| `field`  | Query semantics: `path`, `type`, `operators`, `options`, nested `fields`.        | required                  |
| `value`  | The display read.                                                                | the value at `field.path` |
| `sort`   | `false`, or the path to sort on.                                                 | `field.path`              |
| `filter` | `false`, or operators, an editor, a chip, an options source, an in-memory match. | filterable                |
| `views`  | Config for each view, by view name.                                              | none                      |
| `link`   | A URL, a URL with a target, or a route, per record.                              | none                      |
| `export` | `false`, or the exported value and title.                                        | the display value         |
| `meta`   | Your own data; the library never reads it.                                       | none                      |

`defineProperty` requires a nonempty `label` and `field.path`; the field also
needs a `type`. It fills `key` and `field.label`, copies and freezes plain
objects and arrays, and preserves functions and class instances. Display,
sort and export defaults are resolved by the helpers when read.

## Key, query path and display value

These three settings serve different purposes:

- `key` identifies the property. `findProperty` looks for this first, then
  falls back to `field.path`. Give properties distinct keys.
- `field.path` identifies the data used by filter conditions and the schema.
  Conditions store this path, not the property key; their node ids are separate.
- `value(record)` returns what a view displays. It does not change what
  filtering or sorting reads.

In the project example, the property is called `project`, filters compare
`project.id`, cells display the project name, and sorting reads
`project.name`. Export uses the displayed name unless overridden.
Backend path names belong in the codec's path mapping; see
[backends and codecs](/guides/backends).

## Field configuration

`field` describes query semantics and feeds `schemaFrom(properties)`:

| Setting     | Purpose                                                                                                            | Default          |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `path`      | Dotted record path used by conditions, such as `project.id`.                                                       | required         |
| `type`      | Field kind: `keyword`, `text`, `number`, `date`, `boolean`, `geo`, or a custom string. Helps UIs choose operators. | required         |
| `label`     | Field name used by schema-based UIs.                                                                               | property `label` |
| `operators` | Operators offered by field-based UIs. Property helpers can override these with `filter.operators`.                 | based on type    |
| `options`   | Fixed picker choices as `{ value, label }`; the value is stored in the condition.                                  | none             |
| `nested`    | Marks a list of objects for nested filter scopes.                                                                  | unset            |
| `fields`    | Schema of each nested item's fields, with paths relative to the list.                                              | none             |

A type or operator list describes the UI; it does not install custom
operators or make a backend support them. Register custom operator semantics
and use a codec that can represent them.

`schemaFrom` includes only filterable properties and keys them by
`field.path`. If properties share a path, the first field definition wins;
conflicting types throw. It returns the field definitions, without merging
`filter.operators` or `filter.options` into them.

## Filter configuration

Omit `filter` to allow filtering, use `filter: false` to exclude the property
from property-based filter UIs and `schemaFrom`, or supply:

| Setting           | Purpose                                                                                                        | Default                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `operators`       | Operator ids offered by `operatorsFor(property)`.                                                              | `field.operators`, then defaults by type   |
| `defaultOperator` | Operator returned for a new property condition.                                                                | first offered operator                     |
| `editor`          | Component that edits a condition's operator and value.                                                         | chosen by the consuming UI                 |
| `chip`            | Component that renders a set condition in a summary.                                                           | chosen by the consuming UI                 |
| `options`         | An asynchronous `OptionsSource` for a custom picker.                                                           | `field.options` wrapped by `staticOptions` |
| `local`           | `(record, condition) => boolean` replacing the operator's match for this path in a configured local evaluator. | built-in operator matching                 |

`operatorsFor` uses this precedence: `filter: false` returns no operators;
otherwise `filter.operators` wins over `field.operators`, then field-type
defaults apply:

| Type                                                        | Default operators, in order |
| ----------------------------------------------------------- | --------------------------- |
| `keyword`                                                   | `eq`, `in`, `exists`        |
| `keyword` with nonempty `field.options` or `filter.options` | `in`, `eq`, `exists`        |
| `text`                                                      | `contains`, `exists`        |
| `number`                                                    | `eq`, `range`, `exists`     |
| `date`                                                      | `range`, `eq`, `exists`     |
| `boolean`                                                   | `eq`                        |
| `geo`                                                       | `exists`                    |
| custom type                                                 | `eq`, `exists`              |

When both `filter.operators` and `filter.defaultOperator` are supplied,
`defineProperty` checks that the default is in the list. Keep the default
compatible with the effective operators even when using `field.operators`.

For `filter.local` to run with `memoryBackend`, pass
`{ match: propertyMatcher(properties) }` as backend options. Negation and
disabled-condition handling still apply around the custom match. Remote
backends need their own semantics for the same condition.

Filtering is independent of visibility: hiding a table column does not
remove its filter. `filter: false` controls property-based discovery; it does
not prohibit manually constructing conditions on that path.
See [filtering UIs](/guides/filtering) for editor and chip component arguments.

## Picker options

Use `field.options` for a fixed list:

```ts
const status = defineProperty({
  label: 'Status',
  field: {
    path: 'status',
    type: 'keyword',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'closed', label: 'Closed' },
    ],
  },
});
```

Use `filter.options` for a picker backed by a store or server. An
`OptionsSource` has these methods:

| Method                    | Purpose                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| `load(signal)`            | Required: returns initial options.                                                                  |
| `search(text, signal)`    | Optional: returns options matching typed text. A consumer can fall back to filtering loaded labels. |
| `resolve(values, signal)` | Optional: loads labels for selected values that are absent from the current options.                |

Each method returns a promise of options. An option has a scalar `value`, a
human-readable `label`, and optional `data` for the full record behind it.
Pass the abort signal to your request so the picker can cancel stale work.

`optionsFor(property)` returns `filter.options` first, otherwise wraps
`field.options`, and returns `undefined` for a nonfilterable property.
`staticOptions(options)` supplies all three methods; its search trims text
and matches labels case-insensitively. The source is a contract for picker
consumers: configuring it does not itself fetch or render options.

## Sorting, links and export

| Configuration                     | Effect                                                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| omitted `sort`, or `sort: {}`     | `sortPath` returns `field.path`.                                                                                                  |
| `sort: { path: 'project.name' }`  | Sorts on a different field when the view passes that path to `setSort`.                                                           |
| `sort: false`                     | `isSortable` is false and `sortPath` returns `undefined`.                                                                         |
| `link(record)`                    | Returns a URL string, `{ url, target? }`, `{ route, models?, query?, target? }`, or `undefined` for no link. The view renders it. |
| omitted `export`, or `export: {}` | Export helpers use the display value; an exporter can use the property label as its title.                                        |
| `export: { value, label }`        | Overrides the exported cell value and column title independently.                                                                 |
| `export: false`                   | `isExportable` is false; exporters should skip the property.                                                                      |

These settings describe capabilities, not actions. A view must use the sort
helpers and issue the driver command, render the link, or build the export.
`exportValue` still returns a value for `export: false`; check `isExportable`
when selecting export columns.

`meta` holds application-specific information. The library does not interpret
it. Use `views` for settings that a particular view consumes.

## Builders

Fields of one kind share a builder; each list overrides what differs.
Import `extendProperty` from `ember-search-ui-driver` alongside `defineProperty`.
`extendProperty` merges plain objects deeply and keeps everything else.
Arrays, functions and `false` replace the previous value; `undefined` keeps
it. A key equal to the old field path follows a changed field path, and a
field label equal to the old property label follows a changed label:

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
typed without the core knowing every view. Keys and settings are defined by
the consuming view; `table.width` or `calendar.date` has an effect only if
that view reads it:

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
