# How To Contribute

## Installation

- `git clone <repository-url>`
- `cd ember-search-ui` (the repository root)
- `pnpm install`
- `pnpm build` (the views type-check and test against the built `ember-search-ui`)

## Linting

- `pnpm lint`
- `pnpm lint:fix`

## Building the addon

- `pnpm build`

## Running tests

Run these from `packages/ember-search-ui-views`:

- `pnpm test` – Builds the tests with Vite and runs them in headless Chrome
- `pnpm start` – Starts the Vite dev server; open `/tests/index.html` to run the tests in the browser with live reload

To run against other Ember versions, apply a scenario from `.try.mjs`:

- `pnpm dlx @embroider/try apply ember-lts-5.8 && pnpm install --no-lockfile`
- `ENABLE_COMPAT_BUILD=true pnpm test` (the 5.x scenarios use the classic build)
