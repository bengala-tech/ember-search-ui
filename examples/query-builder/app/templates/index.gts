import { LinkTo } from '@ember/routing';

<template>
  <section class="intro">
    <p>
      Every page uses the same driver and keeps the same internal state: a
      filter tree of groups and conditions. Only the serialization differs.
    </p>
    <ul>
      <li>
        <LinkTo @route="legacy">Legacy (list)</LinkTo>: a legacy filter UI (one
        filter per property, AND only), driven through the search-ui compat API,
        sent as a flat
        <code>filters</code>
        list.
      </li>
      <li>
        <LinkTo @route="groups">New (groups)</LinkTo>: the query builder (nested
        any/all groups, NOT, on/off), sent as the groups spec.
      </li>
      <li>
        <LinkTo @route="legacy-template">Template: legacy drop-in</LinkTo>: a
        list template written for a search-ui driver (WithSearch,
        mapContextToProps, the containers, direct driver calls, an Excel export,
        a
        <code>query</code>
        param), unchanged, on the new driver through
        <code>serverSearch</code>.
      </li>
      <li>
        <LinkTo @route="groups-template">Template: new spec</LinkTo>: the same
        list with
        <code>&lt;Search&gt;</code>
        and a QueryBuilder sending the groups spec, next to an unchanged
        WithSearch view on the same driver.
      </li>
    </ul>
    <p>
      A fake server receives only the JSON request, decodes it, and answers.
      Each page shows the exact request sent.
    </p>
  </section>
</template>
