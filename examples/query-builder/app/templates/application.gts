import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';

<template>
  {{pageTitle "ember-search-ui · Prysmex filters"}}
  <header class="app-header">
    <h1>One filter tree, two Prysmex formats</h1>
    <nav aria-label="Demos">
      <LinkTo @route="legacy" data-test-nav="legacy">Legacy Prysmex (list)</LinkTo>
      <LinkTo @route="groups" data-test-nav="groups">New Prysmex (groups)</LinkTo>
    </nav>
  </header>
  <main class="app-main">
    {{outlet}}
  </main>
</template>
