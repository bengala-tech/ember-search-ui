import type { TOC } from '@ember/component/template-only';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import {
  legacyOf,
  schemaFrom,
  toProperty,
  type AnyProperty,
  type ConditionNode,
  type ConditionPatch,
  type FieldDefinition,
  type FieldSchema,
  type FilterNode,
  type GroupNode,
  type NestedNode,
  type Property,
  type RangeValue,
  type Scalar,
  type SearchDriver,
} from 'ember-search-ui-driver';
import {
  LegacyFilterEditor,
  type FilterEditorSignature,
  type TrackedSearch,
} from 'ember-search-ui';
import type { ComponentLike } from '@glint/template';
import {
  DATE_PRESETS,
  conditionOf,
  conditionsFor,
  formatInput,
  type Bound,
} from '../query-builder/conditions.ts';
import {
  addCondition,
  addGroup,
  addNested,
  conditionFields,
  nestedFields,
  remove,
  setCondition,
  setDateMath,
  setField,
  setListText,
  setNestedPath,
  setOp,
  setQuantifier,
  setScalar,
  setSingle,
  toggleListValue,
} from '../query-builder/actions.ts';
import { eq, not } from '../-private/template-helpers.ts';
import '../styles/query-builder.css';

type Search = TrackedSearch<unknown>;

// --- template helpers -----------------------------------------------------

const asGroup = (node: FilterNode) =>
  node.kind === 'group' ? node : undefined;
const asNested = (node: FilterNode) =>
  node.kind === 'nested' ? node : undefined;
const asCondition = (node: FilterNode) =>
  node.kind === 'condition' ? node : undefined;
const fieldOf = (
  fields: FieldSchema,
  path: string,
): FieldDefinition | undefined => fields[path];
const subFields = (fields: FieldSchema, path: string): FieldSchema =>
  fields[path]?.fields ?? {};
const hasNested = (fields: FieldSchema) => nestedFields(fields).length > 0;
const isOr = (group: GroupNode) => group.op === 'or';

type Properties = readonly AnyProperty<never, unknown>[];

/** The fields to offer: `@fields`, else the schema of `@properties`. */
const fieldsFrom = (
  fields: FieldSchema | undefined,
  properties: Properties | undefined,
): FieldSchema => fields ?? (properties ? schemaFrom(properties) : {});

interface RowEditor {
  property: Property;
  /** A Property's own editor; undefined for a legacy filter component. */
  component?: ComponentLike<FilterEditorSignature>;
}

/** The editor a property brings for this field, if any. */
function editorFor(
  properties: Properties | undefined,
  path: string,
): RowEditor | undefined {
  for (const input of properties ?? []) {
    const property = toProperty(input) as Property;
    if (property.field.path !== path) continue;
    const { filter } = property;
    if (filter && filter.editor)
      return {
        property,
        component: filter.editor as ComponentLike<FilterEditorSignature>,
      };
    if (legacyOf(input)?.componentsForFiltering?.filter?.component)
      return { property };
  }
  return undefined;
}

const updateRow =
  (driver: SearchDriver<unknown>, node: ConditionNode) =>
  (patch: ConditionPatch) =>
    driver.update(node.id, patch);

// clearing an editor leaves the row (it has its own delete button) empty
const clearRow = (driver: SearchDriver<unknown>, node: ConditionNode) => () =>
  driver.update(node.id, { value: undefined, meta: undefined });
const bound = (value: unknown, side: Bound) =>
  (value as RangeValue | undefined)?.[side];
const listOf = (value: unknown) =>
  Array.isArray(value) ? (value as Scalar[]) : [];
const listText = (value: unknown) => listOf(value).map(formatInput).join(', ');
const includes = (value: unknown, option: Scalar) =>
  listOf(value).includes(option);
const isDateMath = (value: unknown) =>
  typeof value === 'object' && value !== null && 'dateMath' in value;
const dateMathOf = (value: unknown) =>
  isDateMath(value) ? (value as { dateMath: string }).dateMath : '';
const dateOf = (value: unknown) =>
  typeof value === 'object' && value !== null && 'date' in value
    ? (value as { date: string }).date.slice(0, 10)
    : '';
const inputType = (field: FieldDefinition | undefined) =>
  field?.type === 'number' ? 'number' : 'text';
const isType = (field: FieldDefinition | undefined, type: string) =>
  field?.type === type;
const nestedLabel = (fields: FieldSchema, path: string) =>
  fields[path]?.label ?? path;
const presetMissing = (expression: string) =>
  expression !== '' && !DATE_PRESETS.some((p) => p.value === expression);
const depthClass = (depth: number) => `sui-qb-depth-${depth % 4}`;
const inc = (depth: number) => depth + 1;
const conditionId = (node: ConditionNode) => conditionOf(node).id;

// --- value inputs -----------------------------------------------------------

interface ScalarInputSignature {
  Args: {
    search: Search;
    node: ConditionNode;
    field: FieldDefinition | undefined;
    /** A side of a range; without it the input sets the single value. */
    side?: Bound;
    label: string;
    value: unknown;
  };
}

/** One value: a date (exact or relative), a number or text. */
const ScalarInput: TOC<ScalarInputSignature> = <template>
  {{#if (isType @field "date")}}
    <input
      type="date"
      class="sui-qb-input"
      aria-label={{@label}}
      value={{dateOf @value}}
      {{on "change" (fn setScalar @search.driver @node @field @side)}}
    />
    <select
      class="sui-qb-select sui-qb-relative"
      aria-label="{{@label}} (relative)"
      {{on "change" (fn setDateMath @search.driver @node @side)}}
    >
      <option value="" selected={{not (isDateMath @value)}}>or relative…</option>
      {{#each DATE_PRESETS as |preset|}}
        <option
          value={{preset.value}}
          selected={{eq preset.value (dateMathOf @value)}}
        >
          {{preset.label}}
        </option>
      {{/each}}
      {{#if (presetMissing (dateMathOf @value))}}
        <option value={{dateMathOf @value}} selected>{{dateMathOf
            @value
          }}</option>
      {{/if}}
    </select>
  {{else}}
    <input
      type={{inputType @field}}
      class="sui-qb-input"
      aria-label={{@label}}
      value={{formatInput @value}}
      {{on "change" (fn setScalar @search.driver @node @field @side)}}
    />
  {{/if}}
</template>;

interface ValueInputSignature {
  Args: {
    search: Search;
    node: ConditionNode;
    field: FieldDefinition | undefined;
  };
}

const ValueInput: TOC<ValueInputSignature> = <template>
  {{#let (conditionOf @node) as |kind|}}
    {{#if (eq kind.shape "single")}}
      {{#if @field.options}}
        <select
          class="sui-qb-select"
          aria-label="Value"
          {{on "change" (fn setSingle @search.driver @node @field)}}
        >
          <option
            value=""
            selected={{eq @node.value undefined}}
          >choose…</option>
          {{#each @field.options as |choice|}}
            <option
              value={{formatInput choice.value}}
              selected={{eq choice.value @node.value}}
            >
              {{choice.label}}
            </option>
          {{/each}}
        </select>
      {{else if (isType @field "boolean")}}
        <select
          class="sui-qb-select"
          aria-label="Value"
          {{on "change" (fn setSingle @search.driver @node @field)}}
        >
          <option
            value=""
            selected={{eq @node.value undefined}}
          >choose…</option>
          <option value="true" selected={{eq @node.value true}}>yes</option>
          <option value="false" selected={{eq @node.value false}}>no</option>
        </select>
      {{else if (isType @field "date")}}
        <ScalarInput
          @search={{@search}}
          @node={{@node}}
          @field={{@field}}
          @label="Date"
          @value={{@node.value}}
        />
      {{else}}
        <input
          type={{inputType @field}}
          class="sui-qb-input"
          aria-label="Value"
          placeholder="value"
          value={{formatInput @node.value}}
          {{on "change" (fn setSingle @search.driver @node @field)}}
        />
      {{/if}}
    {{else if (eq kind.shape "list")}}
      {{#if @field.options}}
        <span class="sui-qb-options" role="group" aria-label="Values">
          {{#each @field.options as |choice|}}
            <label class="sui-qb-option">
              <input
                type="checkbox"
                checked={{includes @node.value choice.value}}
                {{on
                  "change"
                  (fn toggleListValue @search.driver @node choice.value)
                }}
              />
              {{choice.label}}
            </label>
          {{/each}}
        </span>
      {{else}}
        <input
          type="text"
          class="sui-qb-input"
          aria-label="Values, comma separated"
          placeholder="a, b, c"
          value={{listText @node.value}}
          {{on "change" (fn setListText @search.driver @node @field)}}
        />
      {{/if}}
    {{else if (eq kind.shape "bound")}}
      <ScalarInput
        @search={{@search}}
        @node={{@node}}
        @field={{@field}}
        @side={{if kind.bound kind.bound "gte"}}
        @label="Value"
        @value={{bound @node.value (if kind.bound kind.bound "gte")}}
      />
    {{else if (eq kind.shape "between")}}
      <ScalarInput
        @search={{@search}}
        @node={{@node}}
        @field={{@field}}
        @side="gte"
        @label="From"
        @value={{bound @node.value "gte"}}
      />
      <span class="sui-qb-and">and</span>
      <ScalarInput
        @search={{@search}}
        @node={{@node}}
        @field={{@field}}
        @side="lte"
        @label="To"
        @value={{bound @node.value "lte"}}
      />
    {{/if}}
  {{/let}}
</template>;

// --- shared row controls -------------------------------------------------------

interface NodeControlsSignature {
  Args: { search: Search; node: FilterNode; removable: boolean };
}

/** NOT toggle, on/off toggle and remove, for any node. */
const NodeControls: TOC<NodeControlsSignature> = <template>
  <span class="sui-qb-controls">
    <button
      type="button"
      class="sui-qb-toggle sui-qb-not"
      aria-pressed={{if @node.negate "true" "false"}}
      title="Negate"
      {{on "click" (fn @search.driver.toggleNegate @node.id)}}
    >NOT</button>
    <button
      type="button"
      class="sui-qb-toggle sui-qb-enabled"
      aria-pressed={{if @node.disabled "false" "true"}}
      title={{if @node.disabled "Turn on" "Turn off"}}
      {{on "click" (fn @search.driver.toggleDisabled @node.id)}}
    >{{if @node.disabled "off" "on"}}</button>
    {{#if @removable}}
      <button
        type="button"
        class="sui-qb-remove"
        aria-label="Remove"
        title="Remove"
        {{on "click" (fn remove @search.driver @node)}}
      >×</button>
    {{/if}}
  </span>
</template>;

// --- rows -----------------------------------------------------------------------

export interface ConditionEditorSignature {
  Args: {
    search: Search;
    node: ConditionNode;
    field: FieldDefinition | undefined;
  };
}

/** The built-in editor: a condition picker and a value input for the field. */
export const ConditionEditor: TOC<ConditionEditorSignature> = <template>
  <select
    class="sui-qb-select sui-qb-operator"
    aria-label="Condition"
    {{on "change" (fn setCondition @search.driver @node @field)}}
  >
    {{#each (conditionsFor @field) as |kind|}}
      <option value={{kind.id}} selected={{eq kind.id (conditionId @node)}}>
        {{kind.label}}
      </option>
    {{/each}}
  </select>
  <span class="sui-qb-value">
    <ValueInput @search={{@search}} @node={{@node}} @field={{@field}} />
  </span>
</template>;

interface ConditionRowSignature {
  Args: {
    search: Search;
    node: ConditionNode;
    fields: FieldSchema;
    properties?: Properties;
  };
}

const ConditionRow: TOC<ConditionRowSignature> = <template>
  {{#let (fieldOf @fields @node.field) as |field|}}
    <div
      class="sui-qb-condition
        {{if @node.negate 'is-negated'}}
        {{if @node.disabled 'is-disabled'}}"
      data-node-id={{@node.id}}
    >
      <select
        class="sui-qb-select sui-qb-field"
        aria-label="Field"
        {{on "change" (fn setField @search.driver @node @fields)}}
      >
        {{#each (conditionFields @fields) as |choice|}}
          <option value={{choice.path}} selected={{eq choice.path @node.field}}>
            {{if choice.label choice.label choice.path}}
          </option>
        {{/each}}
      </select>
      {{#let (editorFor @properties @node.field) as |rowEditor|}}
        {{#if rowEditor.component}}
          {{#let rowEditor.component as |Editor|}}
            <span class="sui-qb-value sui-qb-editor">
              <Editor
                @property={{rowEditor.property}}
                @node={{@node}}
                @update={{updateRow @search.driver @node}}
                @remove={{clearRow @search.driver @node}}
              />
            </span>
          {{/let}}
        {{else if rowEditor}}
          <span class="sui-qb-value sui-qb-editor">
            <LegacyFilterEditor
              @property={{rowEditor.property}}
              @node={{@node}}
              @update={{updateRow @search.driver @node}}
              @remove={{clearRow @search.driver @node}}
            />
          </span>
        {{else}}
          <ConditionEditor
            @search={{@search}}
            @node={{@node}}
            @field={{field}}
          />
        {{/if}}
      {{/let}}
      <NodeControls @search={{@search}} @node={{@node}} @removable={{true}} />
    </div>
  {{/let}}
</template>;

interface NestedRowSignature {
  Args: {
    search: Search;
    node: NestedNode;
    fields: FieldSchema;
    depth: number;
  };
}

const NestedRow: TOC<NestedRowSignature> = <template>
  <div
    class="sui-qb-nested
      {{if @node.negate 'is-negated'}}
      {{if @node.disabled 'is-disabled'}}"
    data-node-id={{@node.id}}
  >
    <div class="sui-qb-header">
      <select
        class="sui-qb-select"
        aria-label="Quantifier"
        {{on "change" (fn setQuantifier @search.driver @node)}}
      >
        <option
          value="some"
          selected={{eq @node.quantifier "some"}}
        >Some</option>
        <option
          value="every"
          selected={{eq @node.quantifier "every"}}
        >Every</option>
        <option value="none" selected={{eq @node.quantifier "none"}}>No</option>
      </select>
      <select
        class="sui-qb-select"
        aria-label="List"
        {{on "change" (fn setNestedPath @search.driver @node @fields)}}
      >
        {{#each (nestedFields @fields) as |choice|}}
          <option value={{choice.path}} selected={{eq choice.path @node.path}}>
            {{if choice.label choice.label choice.path}}
          </option>
        {{/each}}
      </select>
      <span class="sui-qb-label">item matches</span>
      <NodeControls @search={{@search}} @node={{@node}} @removable={{true}} />
    </div>
    <Group
      @search={{@search}}
      @group={{@node.filter}}
      @fields={{subFields @fields @node.path}}
      @depth={{inc @depth}}
      @scope={{nestedLabel @fields @node.path}}
    />
  </div>
</template>;

// --- groups ---------------------------------------------------------------------

interface GroupSignature {
  Args: {
    search: Search;
    group: GroupNode;
    fields: FieldSchema;
    /** Properties with editors (top-level scope only). */
    properties?: Properties;
    depth: number;
    /** Root groups (and a nested scope's group) cannot be removed or negated. */
    isRoot?: boolean;
    scope?: string;
  };
}

const Group: TOC<GroupSignature> = <template>
  <fieldset
    class="sui-qb-group
      {{depthClass @depth}}
      {{if @group.negate 'is-negated'}}
      {{if @group.disabled 'is-disabled'}}"
    data-node-id={{@group.id}}
  >
    <legend class="sui-qb-header">
      {{#if @group.negate}}<span class="sui-qb-not-badge">NOT</span>{{/if}}
      <span class="sui-qb-label">Match</span>
      <span class="sui-qb-segmented" role="group" aria-label="Combine with">
        <button
          type="button"
          aria-pressed={{if (isOr @group) "false" "true"}}
          {{on "click" (fn setOp @search.driver @group "and")}}
        >all</button>
        <button
          type="button"
          aria-pressed={{if (isOr @group) "true" "false"}}
          {{on "click" (fn setOp @search.driver @group "or")}}
        >any</button>
      </span>
      <span class="sui-qb-label">of{{#if @scope}}
          the
          {{@scope}}
          fields{{/if}}:</span>
      {{#unless @isRoot}}
        <NodeControls
          @search={{@search}}
          @node={{@group}}
          @removable={{true}}
        />
      {{/unless}}
    </legend>

    <ol class="sui-qb-children">
      {{#each @group.children key="id" as |child|}}
        <li class="sui-qb-child">
          {{#let
            (asCondition child) (asGroup child) (asNested child)
            as |condition group nestedNode|
          }}
            {{#if condition}}
              <ConditionRow
                @search={{@search}}
                @node={{condition}}
                @fields={{@fields}}
                @properties={{@properties}}
              />
            {{else if group}}
              <Group
                @search={{@search}}
                @group={{group}}
                @fields={{@fields}}
                @properties={{@properties}}
                @depth={{inc @depth}}
              />
            {{else if nestedNode}}
              <NestedRow
                @search={{@search}}
                @node={{nestedNode}}
                @fields={{@fields}}
                @depth={{@depth}}
              />
            {{/if}}
          {{/let}}
        </li>
      {{else}}
        <li class="sui-qb-empty">No conditions: everything matches.</li>
      {{/each}}
    </ol>

    <div class="sui-qb-footer">
      <button
        type="button"
        class="sui-qb-add"
        data-test-add="condition"
        {{on "click" (fn addCondition @search.driver @group @fields)}}
      >+ Condition</button>
      <button
        type="button"
        class="sui-qb-add"
        data-test-add="group"
        {{on "click" (fn addGroup @search.driver @group @fields)}}
      >+ Group</button>
      {{#if (hasNested @fields)}}
        <button
          type="button"
          class="sui-qb-add"
          data-test-add="list"
          {{on "click" (fn addNested @search.driver @group @fields)}}
        >+ List condition</button>
      {{/if}}
    </div>
  </fieldset>
</template>;

// --- public -----------------------------------------------------------------------

export interface QueryBuilderSignature {
  Element: HTMLDivElement;
  Args: {
    /** A TrackedSearch, e.g. yielded by <Search>. */
    search: Search;
    /** Fields people can filter on (labels, types, options, nested lists). */
    fields?: FieldSchema;
    /**
     * Or properties, in either shape: their filterable fields are offered,
     * and a property's editor (or legacy filter component) edits its rows.
     */
    properties?: Properties;
  };
}

/**
 * Edits the whole filter tree: conditions, AND/OR groups nested to any
 * depth, NOT and on/off on every row and group, and conditions on items of
 * nested lists. Every change is a driver command, so the URL, results and
 * anything else subscribed follow along.
 */
const QueryBuilder: TOC<QueryBuilderSignature> = <template>
  <div class="sui-query-builder" ...attributes>
    <Group
      @search={{@search}}
      @group={{@search.filter}}
      @fields={{fieldsFrom @fields @properties}}
      @properties={{@properties}}
      @depth={{0}}
      @isRoot={{true}}
    />
  </div>
</template>;

export default QueryBuilder;
