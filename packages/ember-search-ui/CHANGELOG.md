# Ember Search Ui Changelog

## 2.0.0

💥 Breaking
- v2 addon (Embroider format), written in TypeScript with `<template>` tag components and Glint types.
- Requires Ember 5.8+ with Embroider or ember-auto-import v2, and Node 20+.
- Helpers are plain functions; default exports are no longer `helper()` classes (named exports unchanged).
- `@view` names must resolve to a registered component; prefer passing the component itself.

🚀 Enhancements
- Typed signatures for every component, including the args containers pass to `@view` and yield.
- `ember-search-ui/template-registry` for Glint in loose-mode apps.

See the repository README, "Upgrading from 1.x".

### Master

🚀 Enhancements
- WithSearch Component
- Sorting Component
- SearchBox Component