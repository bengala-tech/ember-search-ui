/* eslint-disable ember/no-at-ember-render-modifiers -- an opened menu focuses its first item */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import { registerDestructor } from '@ember/destroyable';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import type Owner from '@ember/owner';
import {
  schemaFrom,
  toProperty,
  walk,
  type AnyProperty,
  type FieldPath,
  type FieldSchema,
  type FilterNode,
  type NodeId,
  type Option,
  type OptionsSource,
  type Scalar,
} from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { describePill } from '../query-builder/describe.ts';
import '../styles/filter-pills.css';

export interface FilterPillsSignature {
  Element: HTMLUListElement;
  Args: {
    /** A TrackedSearch, e.g. yielded by <Search>. */
    search: TrackedSearch<never> | TrackedSearch<unknown>;
    /** Labels, value options and collections for the fields filtered on. */
    properties: readonly AnyProperty<never, unknown>[];
    /** Called with the node's id when "Edit" is picked; no Edit without it. */
    onEdit?: (nodeId: NodeId) => void;
  };
}

interface Pill {
  node: FilterNode;
  text: string;
}

const isScalar = (v: unknown): v is Scalar =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

const valuesOf = (value: unknown): Scalar[] =>
  (Array.isArray(value) ? (value as unknown[]) : [value]).filter(isScalar);

const optionKey = (path: FieldPath, value: Scalar) =>
  `${path}\u0000${JSON.stringify(value)}`;

/** The pill (an element inside it) the event happened in. */
const pillOf = (event: Event) =>
  (event.currentTarget as HTMLElement).closest('.sui-fp-pill');

/**
 * The root filters as Kibana-style pills: a node's label, else a short
 * description ("Project: Plant A", "2 conditions"). A NOT pill reads "NOT …"
 * in the danger colour; a switched off pill is struck through. Clicking a
 * pill opens its menu: edit, exclude / include results, disable / re-enable,
 * delete. The × deletes too.
 */
export default class FilterPills extends Component<FilterPillsSignature> {
  @tracked openId?: NodeId;
  /** Option labels fetched from properties' option sources, by field. */
  @tracked resolved: Readonly<Record<FieldPath, readonly Option[]>> = {};

  readonly #requested = new Set<string>();
  readonly #abort = new AbortController();

  constructor(owner: Owner, args: FilterPillsSignature['Args']) {
    super(owner, args);
    registerDestructor(this, () => this.#abort.abort());
  }

  /** Option sources of collection properties, by field path. */
  get sources(): Map<FieldPath, OptionsSource> {
    const sources = new Map<FieldPath, OptionsSource>();
    for (const input of this.args.properties) {
      const { field, filter } = toProperty(input);
      if (filter && filter.options && !field.options && !field.nested) {
        sources.set(field.path, filter.options);
      }
    }
    return sources;
  }

  get fields(): FieldSchema {
    const schema = schemaFrom(this.args.properties);
    const resolved = this.resolved;
    if (Object.keys(resolved).length === 0) return schema;
    const fields = { ...schema };
    for (const [path, options] of Object.entries(resolved)) {
      const field = fields[path];
      if (field) fields[path] = { ...field, options };
    }
    return fields;
  }

  get pills(): Pill[] {
    const nodes = this.args.search.filter.children;
    this.requestOptions(nodes);
    const fields = this.fields;
    return nodes.map((node) => ({ node, text: describePill(node, fields) }));
  }

  /** Fetches the labels of collection values the pills show. */
  requestOptions(nodes: readonly FilterNode[]): void {
    const sources = this.sources;
    if (sources.size === 0) return;
    const wanted = new Map<FieldPath, Scalar[]>();
    for (const root of nodes) {
      for (const node of walk(root)) {
        if (node.kind !== 'condition' || !sources.has(node.field)) continue;
        for (const value of valuesOf(node.value)) {
          const key = optionKey(node.field, value);
          if (this.#requested.has(key)) continue;
          this.#requested.add(key);
          wanted.set(node.field, [...(wanted.get(node.field) ?? []), value]);
        }
      }
    }
    for (const [path, values] of wanted) {
      void this.fetchOptions(path, sources.get(path)!, values);
    }
  }

  async fetchOptions(
    path: FieldPath,
    source: OptionsSource,
    values: Scalar[],
  ): Promise<void> {
    const signal = this.#abort.signal;
    let options: readonly Option[];
    try {
      options = source.resolve
        ? await source.resolve(values, signal)
        : await source.load(signal);
    } catch {
      return; // the pill keeps showing the raw value
    }
    if (signal.aborted) return;
    const known = this.resolved[path] ?? [];
    const added = options.filter(
      (o) => !known.some((k) => k.value === o.value),
    );
    if (added.length === 0) return;
    this.resolved = { ...this.resolved, [path]: [...known, ...added] };
  }

  isOpen = (node: FilterNode): boolean => this.openId === node.id;

  toggle = (id: NodeId): void => {
    this.openId = this.openId === id ? undefined : id;
  };

  close = (): void => {
    this.openId = undefined;
  };

  /** Runs a menu action and closes the menu. */
  pick = (action: () => void): void => {
    this.close();
    action();
  };

  edit = (id: NodeId): void => this.args.onEdit?.(id);
  toggleNegate = (id: NodeId): void => this.args.search.driver.toggleNegate(id);
  toggleDisabled = (id: NodeId): void =>
    this.args.search.driver.toggleDisabled(id);
  remove = (id: NodeId): void => {
    if (this.openId === id) this.close();
    this.args.search.driver.remove(id);
  };

  focusFirst = (menu: Element): void => {
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  };

  /**
   * Closes the pill's menu when focus leaves the pill. Removing a focused
   * element fires focusout while rendering; menu actions close first, so
   * then this pill's menu is no longer the open one and nothing is written.
   */
  onFocusOut = (id: NodeId, event: FocusEvent): void => {
    if (this.openId !== id) return;
    const next = event.relatedTarget as Node | null;
    if (!next || !pillOf(event)?.contains(next)) this.close();
  };

  /** Arrow keys move between items; Escape closes and refocuses the pill. */
  onMenuKey = (event: KeyboardEvent): void => {
    const menu = event.currentTarget as HTMLElement;
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const at = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(at + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[(at - 1 + items.length) % items.length]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        pillOf(event)?.querySelector<HTMLElement>('.sui-fp-pill-text')?.focus();
        this.close();
        break;
    }
  };

  <template>
    <ul class="sui-fp-pills" ...attributes>
      {{#each this.pills key="node.id" as |pill|}}
        <li
          class="sui-fp-pill
            {{if pill.node.negate 'is-negated'}}
            {{if pill.node.disabled 'is-disabled'}}"
          data-node-id={{pill.node.id}}
          {{on "focusout" (fn this.onFocusOut pill.node.id)}}
        >
          <button
            type="button"
            class="sui-fp-pill-text"
            title={{pill.text}}
            aria-haspopup="menu"
            aria-expanded={{if (this.isOpen pill.node) "true" "false"}}
            {{on "click" (fn this.toggle pill.node.id)}}
          >{{pill.text}}</button>
          <button
            type="button"
            class="sui-fp-pill-remove"
            aria-label="Delete filter: {{pill.text}}"
            {{on "click" (fn this.remove pill.node.id)}}
          >×</button>
          {{#if (this.isOpen pill.node)}}
            {{! template-lint-disable no-invalid-interactive }}
            <ul
              class="sui-fp-menu"
              role="menu"
              aria-label={{pill.text}}
              {{didInsert this.focusFirst}}
              {{on "keydown" this.onMenuKey}}
            >
              {{#if @onEdit}}
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    data-pill-action="edit"
                    {{on "click" (fn this.pick (fn this.edit pill.node.id))}}
                  >Edit filter</button>
                </li>
              {{/if}}
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  data-pill-action="negate"
                  {{on
                    "click"
                    (fn this.pick (fn this.toggleNegate pill.node.id))
                  }}
                >{{if
                    pill.node.negate
                    "Include results"
                    "Exclude results"
                  }}</button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  data-pill-action="disable"
                  {{on
                    "click"
                    (fn this.pick (fn this.toggleDisabled pill.node.id))
                  }}
                >{{if
                    pill.node.disabled
                    "Re-enable"
                    "Temporarily disable"
                  }}</button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  class="sui-fp-danger"
                  data-pill-action="delete"
                  {{on "click" (fn this.pick (fn this.remove pill.node.id))}}
                >Delete</button>
              </li>
            </ul>
          {{/if}}
        </li>
      {{/each}}
    </ul>
  </template>
}
