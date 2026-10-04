import { pageTitle } from 'ember-page-title';
import { LinkTo } from '@ember/routing';

<template>
  {{pageTitle "ember-search-ui · legacy and new filters"}}
  <header class="app-header">
    <h1>One filter tree, two request formats</h1>
    <nav aria-label="Demos">
      <LinkTo @route="legacy" data-test-nav="legacy">Legacy (list)</LinkTo>
      <LinkTo @route="groups" data-test-nav="groups">New (groups)</LinkTo>
      <LinkTo @route="legacy-template" data-test-nav="legacy-template">Template:
        legacy drop-in</LinkTo>
      <LinkTo @route="groups-template" data-test-nav="groups-template">Template:
        new spec</LinkTo>
    </nav>
  </header>
  <main class="app-main">
    {{outlet}}
  </main>
</template>
