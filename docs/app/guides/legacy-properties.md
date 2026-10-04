# Legacy properties

Many apps already describe their fields with a mutable property class:
`name`, `valuePath`, `filteredBy`, `sortedBy`, `componentsForFiltering`,
`collection`, `viewConfig`, `localFilteringFunction` and routing fields.
That shape is supported for the long term. Every API that takes properties
takes legacy ones, unchanged, and a list can mix both.

```ts
schemaFrom([...legacyProperties, newProperty]);
memoryBackend(rows, { match: propertyMatcher(legacyProperties) });
searchApiBackend({ request, ...legacyValueHooks(legacyProperties) });
```

```gts
<FilterBar @search={{search}} @properties={{legacyProperties}} />
<QueryBuilder @search={{search}} @properties={{legacyProperties}} />
```

## How they keep working

- **Read live, never changed.** Class getters and setters keep working, and
  nothing is frozen. A conversion is cached until a field changes.
- **Legacy components run unchanged.** A `componentsForFiltering.filter`
  component gets the original property, `@config`, `@value` as search-ui
  gave it, and `@onChange`; `listValues` and `listValue` render chips.
- **Legacy rules.** Paths fall back like the legacy getters; links follow
  `routeName`, then `customRoute` or `propertyRoute` with dynamic segments,
  then `getUrl`.
- **`localFilteringFunction`** runs for in-memory search with its old
  arguments; **`serialize` / `deserialize`** become codec value hooks; a
  **`collection`** becomes an options source.

The State filter in this demo is a legacy class with a legacy picker and a
legacy chip:

<!-- demo:filter-bar -->

## Field by field

| Legacy field                       | Property equivalent                        |
| ---------------------------------- | ------------------------------------------ |
| `name`                             | `label`                                    |
| `valuePath`                        | `value`                                    |
| `filteredBy`                       | `field.path`                               |
| `sortedBy`, `isSortable`           | `sort`                                     |
| `isFilterable`                     | `filter: false`                            |
| `componentsForFiltering`           | `filter.editor`, `filter.chip`             |
| `collection`                       | `filter.options`                           |
| `localFilteringFunction`           | `filter.local`                             |
| `serialize`, `deserialize`         | the codec's `serializeValue`, `parseValue` |
| `viewConfig`                       | `views` and `icon`                         |
| routing fields, `getUrl`, `target` | `link`                                     |
| `exportValuePath`, `skipExport`    | `export`                                   |

## Older search-ui versions

search-ui 1.20 and older store `setFilter(field, ['a', 'b'])` as one array
value (`values: [['a', 'b']]`), and legacy editors read `values[0]`. Pass
`arrays: 'keep'` to `searchUiCompat`, `serverSearch`, `localSearch` and
`<PropertyFilter>` to reproduce that exactly, in the request too.

## Planning a move

`configureLegacyProperties({ hints: true })` logs each legacy field an app
uses, once, with its equivalent. It is off by default; nothing needs to
move.
