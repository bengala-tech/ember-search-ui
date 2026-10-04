import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { modifier } from 'ember-modifier';
import {
  filterToCode,
  searchApiCodec,
  urlCodec,
  type SearchState,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { shareLink } from '../demo/share.ts';

type Tab = 'state' | 'list' | 'groups' | 'url' | 'code';

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
  {
    id: 'code',
    name: 'Code',
    note: 'filterToCode: the filter tree as the builder calls that make it, to paste into an app.',
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
  /** What was just copied, for the button's feedback. */
  @tracked copied: 'output' | 'link' | undefined;

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
        case 'code': {
          const [imports, code] = filterToCode(this.state.filter, {
            imports: true,
            width: 72,
          }).split('\n\n');
          return {
            ok: true,
            text: `${imports}\n\ndriver.replaceFilter(${code});`,
          };
        }
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

  /** A link to this page with this search, when the demo shares its URL. */
  get link(): string | undefined {
    void this.state; // recompute when the search changes
    return shareLink(this.args.search.driver);
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
    this.copied = undefined;
  };

  copy = async (what: 'output' | 'link') => {
    const text = what === 'link' ? this.link : this.output.text;
    try {
      await navigator.clipboard.writeText(text ?? '');
      this.copied = what;
    } catch {
      // no clipboard (permissions, insecure page): the text is selectable
      this.copied = undefined;
    }
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
        <div class="inspector-output">
          <pre
            class="json {{unless this.output.ok 'is-refused'}}"
            data-test-inspector-output
          >{{this.output.text}}</pre>
          <button
            type="button"
            class="inspector-copy"
            data-test-inspector-copy
            {{on "click" (fn this.copy "output")}}
          >{{if (eq this.copied "output") "Copied" "Copy"}}</button>
        </div>
        {{#if this.link}}
          <div class="inspector-link">
            <label for="inspector-link">Link to this search</label>
            <input
              id="inspector-link"
              type="text"
              readonly
              value={{this.link}}
              data-test-share-link
            />
            <button
              type="button"
              data-test-share-copy
              {{on "click" (fn this.copy "link")}}
            >{{if (eq this.copied "link") "Copied" "Copy link"}}</button>
          </div>
        {{/if}}
      </dialog>
    {{/if}}
  </template>
}
