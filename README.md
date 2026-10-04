# ember-search-ui

Ember implementation for [@elastic/search-ui](https://github.com/elastic/search-ui)

This repo holds two [v2 addons](https://rfcs.emberjs.com/id/0507-embroider-v2-package-format/), written in TypeScript with `<template>` tag components (`.gts`) and typed for [Glint](https://typed-ember.gitbook.io/glint/):

| package                                                   | what it is                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| [`ember-search-ui`](packages/ember-search-ui)             | `SearchProvider`, `WithSearch` and the headless `Containers::*` components that connect a search-ui `SearchDriver` to your UI |
| [`ember-search-ui-views`](packages/ember-search-ui-views) | Default views (`SearchBox`, `Facet`, `Results`, `Paging`, `Sorting`, ...) and styles, matching search-ui's React views        |

## Compatibility

- Ember.js v5.8 or above (tested against 5.8, 5.12, 6.4, 6.8, 6.12, latest 7.x, beta)
- Embroider, or ember-auto-import v2
- Node.js v20 or above

## Installation

`@elastic/search-ui` is a peer dependency, install the version you want next to the addon:

```sh
pnpm add @elastic/search-ui ember-search-ui
```

For the default views, also install the views and their peers:

```sh
pnpm add ember-search-ui-views ember-power-select ember-basic-dropdown ember-concurrency
```

The views import their own CSS (and ember-power-select's), so there is nothing else to set up.

## Usage

### With `<template>` tag components

```gts
import { SearchProvider, WithSearch, mapContextToProps } from 'ember-search-ui';
import { Layout, SearchBox, Facet, Results, PagingInfo, Paging } from 'ember-search-ui-views';

const config = {
  apiConnector, // any @elastic/search-ui connector
  alwaysSearchOnInitialLoad: true,
};

<template>
  <SearchProvider @config={{config}} as |driver|>
    <Layout>
      <:header><SearchBox @driver={{driver}} @searchAsYouType={{true}} /></:header>
      <:sideContent>
        <Facet @driver={{driver}} @field="states" @label="States" @filterType="any" />
      </:sideContent>
      <:bodyHeader><PagingInfo @driver={{driver}} /></:bodyHeader>
      <:bodyContent><Results @driver={{driver}} @titleField="title" @urlField="url" /></:bodyContent>
      <:bodyFooter><Paging @driver={{driver}} /></:bodyFooter>
    </Layout>

    <WithSearch @driver={{driver}} @mapContextToProps={{mapContextToProps "totalResults"}} as |state|>
      {{state.totalResults}} results
    </WithSearch>
  </SearchProvider>
</template>
```

`@view` arguments take a component (`@view={{SingleLinksFacet}}`). Apps using classic `.hbs` templates can keep using the global names (`<SearchBox>`, `<Containers::Facet>`, `{{map-context-to-props}}`) and may still pass a registered component's name (`@view="boolean-facet"`).

### Glint in loose-mode (`.hbs`) apps

```ts
import type EmberSearchUiRegistry from 'ember-search-ui/template-registry';
import type EmberSearchUiViewsRegistry from 'ember-search-ui-views/template-registry';

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry
    extends EmberSearchUiRegistry, EmberSearchUiViewsRegistry {}
}
```

You can refer to @elastic/search-ui for the documentation of the driver config, state and actions.

## Upgrading from 1.x

- Requires Ember 5.8+ with Embroider or ember-auto-import v2.
- `ember-search-ui-views` now declares `ember-search-ui`, `ember-power-select` (^9), `ember-basic-dropdown` (^9) and `ember-concurrency` (^5) as peer dependencies; it no longer uses `ember-headlessui`.
- Helpers are plain functions. Their named exports are unchanged; default exports are no longer `helper()` classes.
- `<Results>` renders the addon's `Result` by default instead of looking up the app's `result` component; pass `@resultView` to customise it.
- A string `@view` must name a component registered with a class or a co-located template.
- `<AutocompleteInput>` no longer yields `Button` (it could not be clicked in 1.x).
- A custom `selectedItemComponent` on the views' select trigger receives ember-power-select 9's `@selected`.

## Development

```sh
pnpm install
pnpm test      # builds both addons and runs both test suites
pnpm lint
```

Each package's tests run with Vite + testem in its own directory (`pnpm test` in `packages/*`).

`docs/` is the documentation site: guides with live demos, an API reference checked against the packages, and full examples (one filter tree sent as a legacy `filters` list and as the groups spec, a legacy list template running unchanged on the new driver, and one property list driving every view). `cd docs && pnpm start` runs it.

`examples/sandbox` is a classic Ember 4.4 app and is not part of the pnpm workspace yet.

## Custom UI example

```ts
import Controller from '@ember/controller';

export default class SomeController extends Controller {
  properties = [
    {
      name: 'Name',
      relation: 'contact',
      valuePath: 'name',
      component: 'table/custom/contact-name',
      mayBeSorted: false,
    },
    {
      name: 'Company',
      valuePath: 'contact.company',
      mayBeSorted: false,
    },
    {
      name: 'City / State',
      component: 'table/custom/city-state',
      valuePath: 'cityName',
      mayBeSorted: false,
    },
  ];
  //check @elastic/search-ui for config documentation
  config = {
    onSearch: () => {
      return [
        {
          cityName: 'Monterrey',
          contact: {
            company: 'Acme',
          },
        },
        {
          cityName: 'Madrid',
          contact: {
            company: 'Acme',
          },
        },
      ];
    },
  };
}
```

```hbs
//some.hbs

<SearchProvider @config={{this.config}} as |driver|>
  <Table @driver={{driver}} @properties={{this.properties}} />
</SearchProvider>
```

```hbs
//here's the
<Table />
Component
<div class='flex flex-col overflow-x-auto rounded'>
  <div>
    <div class='inline-block min-w-full align-middle'>
      <div class='overflow-hidden border-b border-gray-200 shadow'>
        <table class='min-w-full divide-y divide-gray-200'>
          <WithSearch
            @driver={{@driver}}
            @mapContextToProps={{map-context-to-props
              'setSort'
              'sortDirection'
              'sortField'
            }}
            as |state|
          >
            <thead>
              <tr>
                {{#each @properties as |column|}}
                  <th
                    scope='col'
                    class='px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50'
                    role='button'
                    {{on
                      'click'
                      (if
                        (not-eq column.mayBeSorted false)
                        (fn
                          state.setSort
                          (if column.sortedBy column.sortedBy column.valuePath)
                          (if
                            (or
                              (eq column.sortedBy state.sortField)
                              (eq column.valuePath state.sortField)
                            )
                            (if (eq state.sortDirection 'asc') 'desc' 'asc')
                            'asc'
                          )
                        )
                        (noop)
                      )
                    }}
                  >
                    <div class='flex items-center content-center'>
                      <div>
                        {{column.name}}
                      </div>
                      {{#if
                        (and
                          (not-eq column.mayBeSorted false)
                          (or
                            (eq column.sortedBy state.sortField)
                            (eq column.valuePath state.sortField)
                          )
                        )
                      }}
                        {{#if (eq state.sortDirection 'asc')}}
                          <Svg
                            @name='svg/arrow-narrow-up'
                            class='flex-initial w-4 h-4 ml-1'
                          />
                        {{else}}
                          <Svg
                            @name='svg/arrow-narrow-down'
                            class='flex-initial w-4 h-4 ml-1'
                          />
                        {{/if}}
                      {{/if}}
                    </div>
                  </th>
                {{/each}}
              </tr>
            </thead>
          </WithSearch>
          <tbody class='bg-white divide-y divide-gray-200'>
            <WithSearch
              @driver={{@driver}}
              @mapContextToProps={{map-context-to-props
                'results'
                'rawResponse'
              }}
              as |state|
            >
              {{#each state.results as |result|}}
                <tr>
                  {{#each @columns as |column|}}
                    <td class='px-6 py-4 whitespace-nowrap {{column.class}}'>
                      {{#if column.component}}
                        {{component
                          column.component
                          column=column
                          result=result
                          rawResponse=state.rawResponse
                        }}
                      {{else}}
                        <div class='text-sm text-gray-700'>
                          {{#if (and column.linkeable column.route)}}
                            <a
                              href={{href-to column.route result.id}}
                              class='hover:text-purple-500'
                            >
                              {{get result column.valuePath}}
                            </a>
                          {{else}}
                            <span>
                              {{get result column.valuePath}}
                            </span>
                          {{/if}}
                        </div>
                      {{/if}}
                    </td>
                  {{/each}}
                </tr>
              {{/each}}
            </WithSearch>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
<WithSearch
  @mapContextToProps={{map-context-to-props
    'pagingStart'
    'pagingEnd'
    'totalResults'
    'current'
    'resultsPerPage'
    'totalPages'
    'setCurrent'
  }}
  @driver={{@driver}}
  as |state|
>
  <Table::Paging
    @current={{state.current}}
    @setCurrent={{state.setCurrent}}
    @totalPages={{state.totalPages}}
    as |paging|
  >
    <div
      class='flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-lg sm:px-6'
    >
      <div class='flex justify-between flex-1 sm:hidden'>
        <button
          type='button'
          class='relative inline-flex items-center px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-md hover:text-gray-500 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 active:bg-gray-100 active:text-gray-700'
          disabled={{paging.previous.disabled}}
          {{on 'click' paging.previous.action}}
        >
          Previous
        </button>
        <button
          type='button'
          disabled={{paging.next.disabled}}
          class='relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-md hover:text-gray-500 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 active:bg-gray-100 active:text-gray-700'
          {{on 'click' paging.next.action}}
        >
          Next
        </button>
      </div>
      <div class='hidden sm:flex-1 sm:flex sm:items-center sm:justify-between'>
        <div class='flex-1'>
          <p class='text-sm leading-5 text-gray-700'>
            Showing
            <span class='font-medium'>
              {{state.pagingStart}}
            </span>
            to
            <span class='font-medium'>
              {{state.pagingEnd}}
            </span>
            of
            <span class='font-medium'>
              {{state.totalResults}}
            </span>
            results
          </p>
        </div>
        <div>
          <nav class='relative z-0 inline-flex shadow-sm'>
            <button
              type='button'
              disabled={{paging.previous.disabled}}
              class='relative inline-flex items-center px-2 py-2 text-sm font-medium leading-5 text-gray-500 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-l-md hover:text-gray-400 focus:z-10 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-100 active:text-gray-500'
              aria-label='Previous'
              {{on 'click' paging.previous.action}}
            >
              <Svg @name='svg/chevron-left' class='w-5 h-5' />
            </button>
            <span
              class='relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300'
            >
              {{state.current}}
            </span>
            <span
              class='relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300'
            >
              /
            </span>
            <span
              class='relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300'
            >
              {{state.totalPages}}
            </span>
            <button
              type='button'
              disabled={{paging.next.disabled}}
              class='relative inline-flex items-center px-2 py-2 -ml-px text-sm font-medium leading-5 text-gray-500 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-r-md hover:text-gray-400 focus:z-10 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-100 active:text-gray-500'
              aria-label='Next'
              {{on 'click' paging.next.action}}
            >
              <Svg @name='svg/chevron-right' class='w-5 h-5' />
            </button>
          </nav>
        </div>
      </div>
    </div>
  </Table::Paging>
</WithSearch>
```
