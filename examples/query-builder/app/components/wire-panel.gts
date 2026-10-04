import type { TOC } from '@ember/component/template-only';
import type { TrackedSearch } from 'ember-search-ui';
import { describeFilter } from 'ember-search-ui-views';
import { FIELDS, type Inspection } from '../demo/data.ts';
import { FORMAT_LABELS, type DemoSession } from '../demo/session.ts';
import JsonBlock from './json-block.gts';

// Reading `snapshot` makes the helper re-run when the driver changes.
const otherFormat = (session: DemoSession, snapshot: unknown) => {
  void snapshot;
  return session.otherFormat();
};
const parse = (body: string) => JSON.parse(body) as unknown;
const formatLabel = (format: keyof typeof FORMAT_LABELS) =>
  FORMAT_LABELS[format];
const filterSummary = (search: TrackedSearch<Inspection>) =>
  describeFilter(search.filter, FIELDS);

const hasTotal = (total: number | undefined) => total !== undefined;
const isError = (search: TrackedSearch<Inspection>) =>
  search.result.status === 'error';
const errorText = (search: TrackedSearch<Inspection>) =>
  search.result.error instanceof Error
    ? search.result.error.message
    : 'the search failed';

const WirePanel: TOC<{
  Args: { session: DemoSession; search: TrackedSearch<Inspection> };
}> = <template>
  <section class="panel" aria-labelledby="internal-title">
    <h2 id="internal-title">Internal state</h2>
    <p class="summary" data-test-summary>{{filterSummary @search}}</p>
    <details>
      <summary>Filter tree (what the driver keeps)</summary>
      <JsonBlock data-test-tree @value={{@search.filter}} />
    </details>
  </section>

  <section class="panel" aria-labelledby="sent-title">
    <h2 id="sent-title">
      Sent to the server
      <span class="tag tag-{{@session.format}}">{{formatLabel
          @session.format
        }}</span>
    </h2>
    {{#if (isError @search)}}
      <p class="refused" data-test-search-error>Not sent:
        {{errorText @search}}</p>
    {{/if}}
    {{#if @session.log.last}}
      <p class="meta">
        POST
        {{@session.log.last.endpoint}}
        ·
        <span data-test-status>{{@session.log.last.status}}</span>
        {{#if (hasTotal @session.log.last.total)}}·
          {{@session.log.last.total}}
          results{{/if}}
      </p>
      <JsonBlock data-test-sent @value={{parse @session.log.last.body}} />
    {{/if}}
  </section>

  <section class="panel" aria-labelledby="other-title">
    {{#let (otherFormat @session @search.snapshot) as |other|}}
      <h2 id="other-title">
        Same state as
        <span class="tag tag-{{other.format}}">{{formatLabel
            other.format
          }}</span>
      </h2>
      {{#if other.ok}}
        <JsonBlock data-test-other @value={{other.request}} />
      {{else}}
        <p class="refused" data-test-refused>
          Cannot be sent as the
          {{formatLabel other.format}}:
          {{other.reason}}
          <span class="meta">(node {{other.nodeId}})</span>
        </p>
      {{/if}}
    {{/let}}
  </section>
</template>;

export default WirePanel;
