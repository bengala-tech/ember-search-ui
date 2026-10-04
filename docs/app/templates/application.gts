import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';

<template>
  {{pageTitle "ember-search-ui"}}
  <header class="app-header">
    <LinkTo @route="index" class="brand">ember-search-ui</LinkTo>
    <nav aria-label="Site">
      <LinkTo
        @route="guide"
        @model="getting-started"
        data-test-nav="guides"
      >Guides</LinkTo>
      <LinkTo @route="examples" data-test-nav="examples">Examples</LinkTo>
      <LinkTo @route="api" data-test-nav="api">API</LinkTo>
    </nav>
  </header>
  <main class="app-main">
    {{outlet}}
  </main>
</template>
