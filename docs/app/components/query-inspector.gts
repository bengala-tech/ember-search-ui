import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import {
  searchApiCodec,
  urlCodec,
  type SearchState,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';

type Tab = 'state' | 'list' | 'groups' | 'url';

const TABS: { id: Tab; name: string; note: string }[] = [
  {
    id: 'state',
    name: 'Internal state',
    note: 'What the driver holds: the filter tree, query, sort and page.',
  },
  {
    id: 'list',
    name: 'Legacy request',
    note: 'searchApiBackend with filters: "list", the flat format search-ui based apps send.',
  },
  {
    id: 'groups',
    name: 'Groups request',
    note: 'searchApiBackend with filters: "groups": nested any/all groups, NOT and on/off.',
  },
  {
    id: 'url',
    name: 'URL',
    note: 'syncUrl / urlCodec: the state as URL parameters.',
  },
];

interface Signature {
  Args: { search: TrackedSearch<never> | TrackedSearch<unknown> };
}

const LIST = searchApiCodec({ filters: 'list' });
const GROUPS = searchApiCodec({ filters: 'groups' });
const URL_CODEC = urlCodec();

const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const eq = (a: unknown, b: unknown) => a === b;

/** Opens a native modal dialog as soon as it is rendered. */
const showModal = modifier((dialog: HTMLDialogElement) => {
  dialog.showModal();
});

/**
 * "Show query": the current search converted, live, into each format the
 * driver can send. One internal state, many serializations.
 */
export default class QueryInspector extends Component<Signature> {
  @tracked isOpen = false;
  @tracked tab: Tab = 'groups';

  get state(): SearchState {
    return this.args.search.state;
  }

  get output(): { ok: boolean; text: string } {
    const { driver } = this.args.search;
    const ctx = driver.codecContext;
    try {
      switch (this.tab) {
        case 'state':
          return {
            ok: true,
            text: pretty({
              query: this.state.query,
              filter: this.state.filter,
              sort: this.state.sort,
              page: this.state.page,
            }),
          };
        case 'list':
          return { ok: true, text: pretty(LIST.serialize(this.state, ctx)) };
        case 'groups':
          return { ok: true, text: pretty(GROUPS.serialize(this.state, ctx)) };
        case 'url': {
          const search = URL_CODEC.serialize(this.state, ctx);
          return {
            ok: true,
            text: search
              ? `?${decodeURIComponent(search)}`
              : '(empty: nothing differs from the defaults)',
          };
        }
      }
    } catch (error) {
      // e.g. the legacy list cannot express OR groups or NOT
      return { ok: false, text: (error as Error).message };
    }
  }

  get note(): string {
    return TABS.find((t) => t.id === this.tab)?.note ?? '';
  }

  open = () => {
    this.isOpen = true;
  };

  close = () => {
    this.isOpen = false;
  };

  show = (tab: Tab) => {
    this.tab = tab;
  };

  <template>
    <button
      type="button"
      class="inspector-open"
      data-test-show-query
      {{on "click" this.open}}
    >Show query</button>
    {{#if this.isOpen}}
      <dialog
        class="inspector"
        aria-label="The query"
        data-test-inspector
        {{showModal}}
        {{on "close" this.close}}
      >
        <header>
          <h3>The query, converted</h3>
          <button
            type="button"
            aria-label="Close"
            data-test-inspector-close
            {{on "click" this.close}}
          >×</button>
        </header>
        <div class="inspector-tabs" role="tablist">
          {{#each TABS as |entry|}}
            <button
              type="button"
              role="tab"
              aria-selected={{if (eq entry.id this.tab) "true" "false"}}
              data-test-inspector-tab={{entry.id}}
              {{on "click" (fn this.show entry.id)}}
            >{{entry.name}}</button>
          {{/each}}
        </div>
        <p class="inspector-note">{{this.note}}</p>
        <pre
          class="json {{unless this.output.ok 'is-refused'}}"
          data-test-inspector-output
        >{{this.output.text}}</pre>
      </dialog>
    {{/if}}
  </template>
}
