# ember-search-ui
Ember implementation for @elastic/search-ui


## Still needs documentation, but here's a quick example.

### This repo comes with a handy example, look at examples/sandbox. 

Running the example locally, clone the repo, 
`yarn install`, 
`cd ember-search-ui/examples/sandbox`, 
`ember s` 

[Live Demo](https://ember-search-ui.netlify.app/)



You can basically refer to @elastic/search-ui for the documentation and use the example/sandbox's code to get a grip of what's going on for ember specifics.



## Custom UI example

```ts
import Controller from '@ember/controller';

export default class SomeController extends Controller {
 columns = [
    {
      name: 'Name',
      relation: 'contact',
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
      mayBeSorted: false,
    },
  ];
  
  config = {} //check @elastic/search-ui for config documentation
}

```

```hbs
//some.hbs

<SearchProvider @config={{this.config}} as |driver|>
  <Table @driver={{driver}} @columns={{this.columns}} />
</SearchProvider>

```


```hbs
//here's the <Table /> Component
<div class="flex flex-col overflow-x-auto rounded">
  <div>
    <div class="inline-block min-w-full align-middle">
      <div class="overflow-hidden border-b border-gray-200 shadow">
        <table class="min-w-full divide-y divide-gray-200">
          <WithSearch
            @driver={{@driver}}
            @mapContextToProps={{map-context-to-props
              "setSort"
              "sortDirection"
              "sortField"
            }} as |state|
          >
            <thead>
              <tr>
                {{#each @columns as |column|}}
                  <th
                    scope="col"
                    class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-gray-50"
                    role="button"
                    {{on
                      "click"
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
                            (if (eq state.sortDirection "asc") "desc" "asc")
                            "asc"
                          )
                        )
                        (noop)
                      )
                    }}
                  >
                    <div class="flex items-center content-center">
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
                        {{#if (eq state.sortDirection "asc")}}
                          <Svg
                            @name="svg/arrow-narrow-up"
                            class="flex-initial w-4 h-4 ml-1"
                          />
                        {{else}}
                          <Svg
                            @name="svg/arrow-narrow-down"
                            class="flex-initial w-4 h-4 ml-1"
                          />
                        {{/if}}
                      {{/if}}
                    </div>
                  </th>
                {{/each}}
              </tr>
            </thead>
          </WithSearch>
          <tbody class="bg-white divide-y divide-gray-200">
            <WithSearch
              @driver={{@driver}}
              @mapContextToProps={{map-context-to-props
                "results"
                "rawResponse"
              }} as |state|
            >
              {{#each state.results as |result|}}
                <tr>
                  {{#each @columns as |column|}}
                    <td class="px-6 py-4 whitespace-nowrap {{column.class}}">
                      {{#if column.component}}
                        {{component
                          column.component
                          column=column
                          result=result
                          rawResponse=state.rawResponse
                        }}
                      {{else}}
                        <div class="text-sm text-gray-700">
                          {{#if (and column.linkeable column.route)}}
                            <a
                              href={{href-to column.route result.id}}
                              class="hover:text-purple-500"
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
    "pagingStart"
    "pagingEnd"
    "totalResults"
    "current"
    "resultsPerPage"
    "totalPages"
    "setCurrent"
  }}
  @driver={{@driver}} as |state|
>
  <Table::Paging
    @current={{state.current}}
    @setCurrent={{state.setCurrent}}
    @totalPages={{state.totalPages}} as |paging|
  >
    <div
      class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-b-lg sm:px-6"
    >
      <div class="flex justify-between flex-1 sm:hidden">
        <button
          type="button"
          class="relative inline-flex items-center px-4 py-2 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-md hover:text-gray-500 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 active:bg-gray-100 active:text-gray-700"
          disabled={{paging.previous.disabled}}
          {{on "click" paging.previous.action}}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={{paging.next.disabled}}
          class="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium leading-5 text-gray-700 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-md hover:text-gray-500 focus:outline-none focus:shadow-outline-blue focus:border-blue-300 active:bg-gray-100 active:text-gray-700"
          {{on "click" paging.next.action}}
        >
          Next
        </button>
      </div>
      <div class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div class="flex-1">
          <p class="text-sm leading-5 text-gray-700">
            Showing
            <span class="font-medium">
              {{state.pagingStart}}
            </span>
            to
            <span class="font-medium">
              {{state.pagingEnd}}
            </span>
            of
            <span class="font-medium">
              {{state.totalResults}}
            </span>
            results
          </p>
        </div>
        <div>
          <nav class="relative z-0 inline-flex shadow-sm">
            <button
              type="button"
              disabled={{paging.previous.disabled}}
              class="relative inline-flex items-center px-2 py-2 text-sm font-medium leading-5 text-gray-500 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-l-md hover:text-gray-400 focus:z-10 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-100 active:text-gray-500"
              aria-label="Previous"
              {{on "click" paging.previous.action}}
            >
              <Svg @name="svg/chevron-left" class="w-5 h-5" />
            </button>
            <span
              class="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300"
            >
              {{state.current}}
            </span>
            <span
              class="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300"
            >
              /
            </span>
            <span
              class="relative inline-flex items-center px-4 py-2 -ml-px text-sm font-medium leading-5 text-gray-700 bg-white border border-gray-300"
            >
              {{state.totalPages}}
            </span>
            <button
              type="button"
              disabled={{paging.next.disabled}}
              class="relative inline-flex items-center px-2 py-2 -ml-px text-sm font-medium leading-5 text-gray-500 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-r-md hover:text-gray-400 focus:z-10 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:bg-gray-100 active:text-gray-500"
              aria-label="Next"
              {{on "click" paging.next.action}}
            >
              <Svg @name="svg/chevron-right" class="w-5 h-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  </Table::Paging>
</WithSearch>
```
