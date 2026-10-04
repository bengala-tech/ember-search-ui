import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import { Search } from 'ember-search-ui';
import { QueryBuilder } from 'ember-search-ui-views';
import WithSearch from 'ember-search-ui/components/with-search';
import PagingContainer from 'ember-search-ui/components/containers/paging';
import mapContextToProps from 'ember-search-ui/helpers/map-context-to-props';
import { fn } from '@ember/helper';
import config from 'docs/config/environment';
import { memoryHistory } from 'ember-search-ui-driver';
import { FIELDS } from '../demo/data.ts';
import { TEST_URL } from '../demo/session.ts';
import type GroupsTemplateController from '../controllers/groups-template.ts';
import { asSearchUiDriver } from '../example/as-search-ui-driver.ts';

// The same list on the new spec. <Search> yields the tracked search (state,
// results, driver commands); the QueryBuilder edits the filter tree (groups,
// OR, NOT, on/off). The existing views keep using WithSearch and the
// containers on the same driver, so they can move over one at a time.

const URL_SYNC = {
  prefix: 'q.',
  ...(config.environment === 'test'
    ? { adapter: memoryHistory(TEST_URL.value) }
    : {}),
};

<template>
  <section class="template-page" data-test-groups-template>
    <h2>List template, new groups spec</h2>
    <Search
      @driver={{@controller.searchDriver.driver}}
      @syncUrl={{URL_SYNC}}
      as |search|
    >
      <QueryBuilder @search={{search}} @fields={{FIELDS}} />

      <p data-test-total>{{search.total}} results</p>
      <ul class="template-results">
        {{#each search.results as |row|}}
          <li data-test-row={{row.id}}>{{row.title}}
            <small>{{row.state}}</small></li>
        {{/each}}
      </ul>
      <button
        type="button"
        data-test-export
        {{on "click" @controller.exportToExcel}}
      >
        Export to Excel
      </button>
    </Search>

    {{! an existing view, unchanged, on the same driver }}
    {{#let (asSearchUiDriver @controller.searchDriver) as |driver|}}
      <WithSearch
        @driver={{driver}}
        @mapContextToProps={{mapContextToProps "totalResults"}}
        as |state|
      >
        <p data-test-with-search-total>WithSearch sees
          {{state.totalResults}}
          results</p>
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
    {{/let}}

    <h3>Last request sent</h3>
    {{#if @controller.log.last}}
      <p data-test-last-endpoint>{{@controller.log.last.endpoint}}</p>
      <pre
        class="json"
        data-test-last-request
      >{{@controller.log.last.body}}</pre>
    {{/if}}
  </section>
</template> satisfies TOC<{ Args: { controller: GroupsTemplateController } }>;
