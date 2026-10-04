import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { TrackedSearch } from 'ember-search-ui';
import type {
  FieldDefinition,
  Scalar,
  SearchUiCompat,
  SearchUiFilter,
} from 'ember-search-ui-driver';
import { FIELDS, type Inspection } from '../demo/data.ts';

// Prysmex's current filter UI, rebuilt on the search-ui compat API: one
// filter per property, AND only, a condition per property type. It only
// calls compat.actions.setFilter / removeFilter / clearFilters, the way the
// Prysmex components do, so what it sends is the legacy list.

type Condition =
  'contains' | 'is' | 'any_of' | 'between' | 'greater' | 'less' | 'exists';

const CONDITION_LABELS: Record<Condition, string> = {
  contains: 'contains',
  is: 'is',
  any_of: 'is any of',
  between: 'is between',
  greater: 'is greater than / after',
  less: 'is less than / before',
  exists: 'has a value',
};

function conditionsFor(field: FieldDefinition | undefined): Condition[] {
  switch (field?.type) {
    case 'text':
      return ['contains', 'exists'];
    case 'number':
      return ['is', 'between', 'greater', 'less', 'exists'];
    case 'date':
      return ['between', 'greater', 'less', 'exists'];
    default:
      return field?.options ? ['is', 'any_of', 'exists'] : ['is', 'exists'];
  }
}

const RANGE_KEY: Partial<Record<Condition, string>> = {
  greater: 'gt',
  less: 'lt',
};

function inferCondition(
  filter: SearchUiFilter | undefined,
  field: FieldDefinition | undefined,
): Condition {
  const value = filter?.values[0];
  if (filter && filter.values.length > 1) return 'any_of';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.includes('exists')) return 'exists';
    if (keys.length === 1 && keys[0] === 'gt') return 'greater';
    if (keys.length === 1 && keys[0] === 'lt') return 'less';
    return 'between';
  }
  return conditionsFor(field)[0]!;
}

interface Row {
  field: string;
  def: FieldDefinition | undefined;
  filter: SearchUiFilter | undefined;
  condition: Condition;
  conditions: Condition[];
}

const inputValue = (event: Event) => (event.target as HTMLInputElement).value;
const conditionLabel = (condition: Condition) => CONDITION_LABELS[condition];
const eq = (a: unknown, b: unknown) => a === b;
const text = (value: unknown) =>
  value === undefined || value === null
    ? ''
    : typeof value === 'string'
      ? value
      : JSON.stringify(value);
const first = (filter: SearchUiFilter | undefined) => filter?.values[0];
const bound = (filter: SearchUiFilter | undefined, key: string) =>
  text((filter?.values[0] as Record<string, unknown> | undefined)?.[key]);
const hasValue = (filter: SearchUiFilter | undefined, value: Scalar) =>
  filter?.values.includes(value) ?? false;
const inputType = (def: FieldDefinition | undefined) =>
  def?.type === 'number' ? 'number' : def?.type === 'date' ? 'date' : 'text';
const fieldLabel = (field: string) => FIELDS[field]?.label ?? field;
const ALL_FIELDS = Object.values(FIELDS);

interface Signature {
  Args: {
    compat: SearchUiCompat<Inspection>;
    search: TrackedSearch<Inspection>;
  };
}

export default class LegacyFilters extends Component<Signature> {
  /** Properties added that have no value yet (so nothing is sent for them). */
  @tracked pending: string[] = [];
  /** The condition picked per property, while its value is incomplete. */
  @tracked picked: Record<string, Condition> = {};

  get rows(): Row[] {
    void this.args.search.snapshot; // re-render when the driver changes
    const filters = this.args.compat.getState().filters;
    const fields = [
      ...filters.map((f) => f.field),
      ...this.pending.filter(
        (field) => !filters.some((f) => f.field === field),
      ),
    ];
    return fields.map((field) => {
      const def = FIELDS[field];
      const filter = filters.find((f) => f.field === field);
      return {
        field,
        def,
        filter,
        condition: this.picked[field] ?? inferCondition(filter, def),
        conditions: conditionsFor(def),
      };
    });
  }

  get available() {
    const used = new Set(this.rows.map((r) => r.field));
    return ALL_FIELDS.filter((f) => !used.has(f.path));
  }

  addProperty = (event: Event) => {
    const field = inputValue(event);
    (event.target as HTMLSelectElement).value = '';
    if (!field) return;
    this.pending = [...this.pending, field];
    if (conditionsFor(FIELDS[field])[0] === 'exists')
      this.#setFilter(field, { exists: true });
  };

  setCondition = (row: Row, event: Event) => {
    const condition = inputValue(event) as Condition;
    this.picked = { ...this.picked, [row.field]: condition };
    this.#keep(row.field);
    if (condition === 'exists') this.#setFilter(row.field, { exists: true });
    else this.args.compat.actions.removeFilter(row.field); // values differ per condition
  };

  setSingle = (row: Row, event: Event) => {
    const raw = inputValue(event);
    const option = row.def?.options?.find((o) => String(o.value) === raw);
    const value = option
      ? option.value
      : row.def?.type === 'number' && raw !== ''
        ? Number(raw)
        : raw;
    this.#keep(row.field);
    this.#setFilter(row.field, value);
  };

  setBound = (row: Row, key: string, event: Event) => {
    const raw = inputValue(event);
    const current = {
      ...((first(row.filter) as Record<string, unknown> | undefined) ?? {}),
    };
    delete current['exists'];
    if (raw === '') delete current[key];
    else current[key] = row.def?.type === 'number' ? Number(raw) : raw;
    this.#keep(row.field);
    this.#setFilter(row.field, Object.keys(current).length ? current : null);
  };

  setOne = (row: Row, event: Event) =>
    this.setBound(row, RANGE_KEY[row.condition] ?? 'gt', event);

  toggleOption = (row: Row, value: Scalar, event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    const values = (row.filter?.values ?? []).filter((v) => v !== value);
    if (checked) values.push(value);
    this.#keep(row.field);
    this.#setFilter(row.field, values);
  };

  remove = (row: Row) => {
    this.pending = this.pending.filter((f) => f !== row.field);
    const picked = { ...this.picked };
    delete picked[row.field];
    this.picked = picked;
    this.args.compat.actions.removeFilter(row.field);
  };

  clear = () => {
    this.pending = [];
    this.picked = {};
    this.args.compat.actions.clearFilters();
  };

  #keep(field: string) {
    if (!this.pending.includes(field)) this.pending = [...this.pending, field];
  }

  /** What Prysmex does: setFilter(field, value, 'any'); blank removes it. */
  #setFilter(field: string, value: unknown) {
    this.args.compat.actions.setFilter(field, value, 'any');
  }

  <template>
    <section class="legacy-filters" aria-label="Filters">
      <div class="toolbar">
        <label class="add">
          <span>Add filter</span>
          <select data-test-add-property {{on "change" this.addProperty}}>
            <option value="">Choose a property…</option>
            {{#each this.available as |field|}}
              <option value={{field.path}}>{{field.label}}</option>
            {{/each}}
          </select>
        </label>
        {{#if this.rows.length}}
          <button
            type="button"
            class="link"
            data-test-clear
            {{on "click" this.clear}}
          >Clear filters</button>
        {{/if}}
      </div>

      <ol class="legacy-rows">
        {{#each this.rows key="field" as |row index|}}
          <li class="legacy-row" data-test-filter={{row.field}}>
            {{#if index}}<span class="and">AND</span>{{/if}}
            <strong>{{fieldLabel row.field}}</strong>
            <select
              aria-label="Condition"
              data-test-condition
              {{on "change" (fn this.setCondition row)}}
            >
              {{#each row.conditions as |condition|}}
                <option
                  value={{condition}}
                  selected={{eq condition row.condition}}
                >{{conditionLabel condition}}</option>
              {{/each}}
            </select>

            {{#if (eq row.condition "is")}}
              {{#if row.def.options}}
                <select
                  aria-label="Value"
                  data-test-value
                  {{on "change" (fn this.setSingle row)}}
                >
                  <option value="">choose…</option>
                  {{#each row.def.options as |choice|}}
                    <option
                      value={{text choice.value}}
                      selected={{eq choice.value (first row.filter)}}
                    >{{choice.label}}</option>
                  {{/each}}
                </select>
              {{else}}
                <input
                  aria-label="Value"
                  data-test-value
                  type={{inputType row.def}}
                  value={{text (first row.filter)}}
                  {{on "change" (fn this.setSingle row)}}
                />
              {{/if}}
            {{else if (eq row.condition "contains")}}
              <input
                aria-label="Value"
                data-test-value
                type="text"
                value={{text (first row.filter)}}
                {{on "change" (fn this.setSingle row)}}
              />
            {{else if (eq row.condition "any_of")}}
              <span class="choices" role="group" aria-label="Values">
                {{#each row.def.options as |choice|}}
                  <label>
                    <input
                      type="checkbox"
                      data-test-choice={{text choice.value}}
                      checked={{hasValue row.filter choice.value}}
                      {{on "change" (fn this.toggleOption row choice.value)}}
                    />
                    {{choice.label}}
                  </label>
                {{/each}}
              </span>
            {{else if (eq row.condition "between")}}
              <input
                aria-label="From"
                data-test-from
                type={{inputType row.def}}
                value={{bound row.filter "gte"}}
                {{on "change" (fn this.setBound row "gte")}}
              />
              <span>and</span>
              <input
                aria-label="To"
                data-test-to
                type={{inputType row.def}}
                value={{bound row.filter "lte"}}
                {{on "change" (fn this.setBound row "lte")}}
              />
            {{else if (eq row.condition "greater")}}
              <input
                aria-label="Value"
                data-test-value
                type={{inputType row.def}}
                value={{bound row.filter "gt"}}
                {{on "change" (fn this.setOne row)}}
              />
            {{else if (eq row.condition "less")}}
              <input
                aria-label="Value"
                data-test-value
                type={{inputType row.def}}
                value={{bound row.filter "lt"}}
                {{on "change" (fn this.setOne row)}}
              />
            {{/if}}

            <button
              type="button"
              class="remove"
              aria-label="Remove {{fieldLabel row.field}} filter"
              data-test-remove
              {{on "click" (fn this.remove row)}}
            >×</button>
          </li>
        {{else}}
          <li class="hint">No filters: every inspection matches.</li>
        {{/each}}
      </ol>
    </section>
  </template>
}
