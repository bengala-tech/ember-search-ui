import { LinkTo } from '@ember/routing';

<template>
  <section class="home">
    <h1>Search experiences, one field at a time</h1>
    <p class="lead">
      ember-search-ui is a search driver with a flexible filter tree, a way to
      describe your fields once (Properties), and headless views that turn them
      into filter bars, query builders, tables, lists and calendars, on any
      backend.
    </p>
    <p class="cta">
      <LinkTo @route="guides.getting-started" class="button">Get started</LinkTo>
      <LinkTo @route="examples" class="button secondary">See the examples</LinkTo>
    </p>
    <div class="cards">
      <div class="card">
        <h2>The driver</h2>
        <p>
          One search state: a tree of AND/OR groups with NOT, on/off switches
          and nested list conditions, plus sort and paging. Frameworks
          subscribe; codecs translate it to any API.
        </p>
      </div>
      <div class="card">
        <h2>Properties</h2>
        <p>
          Describe a field once: how to read, filter, sort, link and export it.
          Every view reads the same properties, so a new view or a new field is
          one change, not many.
        </p>
      </div>
      <div class="card">
        <h2>Headless views</h2>
        <p>
          Filter bars, chips and a query builder ship ready; tables, lists,
          calendars and maps are short components over the driver and the
          properties.
        </p>
      </div>
    </div>
  </section>
</template>
