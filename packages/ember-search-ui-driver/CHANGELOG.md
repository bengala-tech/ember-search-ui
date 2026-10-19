# ember-search-ui-driver Changelog

## 2.0.0

🚀 Enhancements

- Node labels: any filter node (condition, group or nested scope) can have a `label`, a name for UIs such as a pill's text. It is never sent to a backend, and an empty or blank label means none.
  - `named(label, node)` builds a labelled node; `update(id, { label })` sets, changes or (with `undefined` or a blank string) removes it.
  - `nodeLabel(node)` reads it, falling back to a string `meta.label`, where apps already kept one.
  - The URL codec round-trips labels (`{"label": "...", "node": [...]}`); URLs without them still parse.
  - The search API codecs (list and groups formats) never send a label, and parsing never produces one.
  - `filterToCode` prints labelled nodes as `named('...', node)`.
