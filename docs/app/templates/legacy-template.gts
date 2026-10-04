import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
// the same deep imports legacy apps use
import WithSearch from 'ember-search-ui/components/with-search';
import PagingContainer from 'ember-search-ui/components/containers/paging';
import PagingInfoContainer from 'ember-search-ui/components/containers/paging-info';
import SortingContainer from 'ember-search-ui/components/containers/sorting';
import SearchBoxContainer from 'ember-search-ui/components/containers/search-box';
import mapContextToProps from 'ember-search-ui/helpers/map-context-to-props';
import JsonBlock from '../components/json-block.gts';
import type LegacyTemplateController from '../controllers/legacy-template.ts';
import { asSearchUiDriver } from '../example/as-search-ui-driver.ts';

// A legacy list template, as written for a search-ui driver. Nothing
// here knows the driver changed: WithSearch, mapContextToProps, the
// containers and the direct driver calls all go through the search-ui API.

const SORT_OPTIONS = [
  { name: 'Newest', value: 'created_at', direction: 'desc' as const },
  { name: 'Oldest', value: 'created_at', direction: 'asc' as const },
];

const titlesOf = (results: unknown) =>
  (results as { id: number; title: string; state: string }[]) ?? [];

<template>
  {{#let (asSearchUiDriver @controller.searchDriver) as |driver|}}
    <section class="template-page" data-test-legacy-template>
      <h2>List template, legacy drop-in</h2>

      <div class="toolbar">
        <SearchBoxContainer @driver={{driver}} as |box|>
          <input
            type="search"
            aria-label="Search"
            placeholder="Search"
            data-test-search
            value={{box.value}}
            {{on "change" box.onChange}}
          />
        </SearchBoxContainer>

        <SortingContainer
          @driver={{driver}}
          @sortOptions={{SORT_OPTIONS}}
          as |sorting|
        >
          <button
            type="button"
            data-test-sort-oldest
            {{on "click" (fn sorting.onChange "created_at|||asc")}}
          >Oldest first</button>
        </SortingContainer>

        <button
          type="button"
          data-test-only-pending
          {{on "click" @controller.onlyPending}}
        >
          Only pending
        </button>
        <button
          type="button"
          data-test-march
          {{on "click" @controller.createdInMarch}}
        >
          Created in March (Date objects, like the calendar)
        </button>
        <button
          type="button"
          data-test-clear
          {{on "click" @controller.clearFilters}}
        >
          Clear filters
        </button>
        <button
          type="button"
          data-test-export
          {{on "click" @controller.exportToExcel}}
        >
          Export to Excel
        </button>
      </div>

      <WithSearch
        @driver={{driver}}
        @mapContextToProps={{mapContextToProps
          "results"
          "filters"
          "totalResults"
        }}
        as |state|
      >
        <p data-test-total>{{state.totalResults}} results</p>
        <ul class="template-results">
          {{#each (titlesOf state.results) as |row|}}
            <li data-test-row={{row.id}}>{{row.title}}
              <small>{{row.state}}</small></li>
          {{/each}}
        </ul>
        <h3>search-ui filters</h3>
        <JsonBlock @value={{state.filters}} data-test-filters />
      </WithSearch>

      <PagingContainer @driver={{driver}} as |paging|>
        <nav aria-label="Pages" class="pager">
          <span data-test-page>{{paging.current}} / {{paging.totalPages}}</span>
          <button
            type="button"
            data-test-next
            {{on "click" (fn paging.onChange 2)}}
          >Page 2</button>
        </nav>
      </PagingContainer>
      <PagingInfoContainer @driver={{driver}} as |info|>
        <p data-test-paging-info>{{info.start}}–{{info.end}}
          of
          {{info.totalResults}}</p>
      </PagingInfoContainer>

      <h3>Last request sent</h3>
      {{#if @controller.log.last}}
        <p data-test-last-endpoint>{{@controller.log.last.endpoint}}</p>
        <pre
          class="json"
          data-test-last-request
        >{{@controller.log.last.body}}</pre>
      {{/if}}
      <h3>The <code>query</code> param</h3>
      <pre class="json" data-test-query>{{@controller.query}}</pre>
    </section>
  {{/let}}
</template> satisfies TOC<{ Args: { controller: LegacyTemplateController } }>;
