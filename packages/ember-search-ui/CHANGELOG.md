# Ember Search Ui Changelog

## 2.0.0

💥 Breaking
- v2 addon (Embroider format), written in TypeScript with `<template>` tag components and Glint types.
- Requires Ember 5.8+ with Embroider or ember-auto-import v2, and Node 20+.
- Helpers are plain functions; default exports are no longer `helper()` classes (named exports unchanged).
- `@view` names must resolve to a registered component; prefer passing the component itself.
- `Containers::Facet` no longer takes `@options`; in block form it yields the visible, filtered facet values.

🚀 Enhancements
- Typed signatures for every component, including the args containers pass to `@view` and yield.
- `ember-search-ui/template-registry` for Glint in loose-mode apps.
- `Containers::SearchBox` accepts `@onSelectAutocomplete(selection, { setSearchTerm, autocompleteResults, autocompleteSuggestions }, defaultOnSelectAutocomplete)`, as in @elastic/react-search-ui. `@handleOnSelectAutocomplete` still works but is deprecated.

🐛 Bug fixes
- Selecting an autocomplete suggestion through the default handler no longer throws.
- `@clickThroughTags` on `Containers::Results` / `Containers::Result` are sent with tracked clicks (they were dropped).
- `Containers::Facet` in block form yielded no options.

See the repository README, "Upgrading from 1.x".

### Master

🚀 Enhancements
- WithSearch Component
- Sorting Component
- SearchBox Component