import { LinkTo } from '@ember/routing';

<template>
  <section class="intro">
    <p>
      Both pages use the same driver and keep the same internal state: a filter
      tree of groups and conditions. Only the serialization differs.
    </p>
    <ul>
      <li>
        <LinkTo @route="legacy">Legacy Prysmex</LinkTo>: today's filter UI (one
        filter per property, AND only), driven through the search-ui compat API,
        sent as the
        <code>filters</code>
        list Prysmex sends today.
      </li>
      <li>
        <LinkTo @route="groups">New Prysmex</LinkTo>: the query builder (nested
        any/all groups, NOT, on/off), sent as the documented groups spec.
      </li>
    </ul>
    <p>
      A fake Prysmex server receives only the JSON request, decodes it, and
      answers. Each page shows the internal tree, the exact request sent, and
      the same state in the other format.
    </p>
  </section>
</template>
