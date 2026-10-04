# ember-search-ui-views Changelog

## 2.0.0

💥 Breaking
- v2 addon (Embroider format), written in TypeScript with `<template>` tag components and Glint types.
- Requires Ember 5.8+ with Embroider or ember-auto-import v2, and Node 20+.
- Peer dependencies: `ember-search-ui`, `ember-power-select` ^9, `ember-basic-dropdown` ^9, `ember-concurrency` ^5. `ember-headlessui` is no longer used.
- `<Results>` renders this addon's `Result` by default instead of the app's `result` component.
- `<AutocompleteInput>` no longer yields `Button`.

🐛 Bug fixes
- SearchBox: no longer throws on submit / Enter / ArrowUp (removed `Ember` global).
- SearchBox: the autocomplete menu no longer leaks a window keydown listener.
- `Result` no longer crashes with a url but no `@onClickLink`.
- `<SearchBox @onSelectAutocomplete>` is now used (it was never forwarded).
- `<Results @clickThroughTags>` is now forwarded.

See the repository README, "Upgrading from 1.x".
