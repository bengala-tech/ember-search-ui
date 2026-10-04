import type { FieldDefinition, FieldSchema } from './codec.ts';
import { toProperty, type AnyProperty } from './legacy-property.ts';
import type { EvaluateOptions } from './evaluate.ts';
import type { ConditionNode, FieldPath, OperatorId, Scalar } from './types.ts';

// A Property describes one field of a record once: how to read it, filter
// it, sort it, link it and show it. Every view reads the same properties
// over the same driver; views never fetch. The layers:
//
//   field    query semantics (the driver's FieldDefinition)
//   value    display read          sort     sortable, and on which path
//   filter   operators, editor, options, in-memory match
//   views    per-view config, an open registry (declaration merging)
//   link     where a record goes   export   whether and how it is exported
//   meta     app data the library never reads
//
// Properties are frozen plain objects made by `defineProperty`. A property
// knows nothing about the backend: codecs rename paths (`paths` options).

/**
 * Per-view configuration. Each view declares its key:
 *
 *   declare module 'ember-search-ui-driver' {
 *     interface PropertyViews { table?: { width?: number } }
 *   }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PropertyViews {}

/** A link to a route, for apps with a router. */
export interface RouteLink {
  route: string;
  models?: readonly unknown[];
  query?: Readonly<Record<string, unknown>>;
  target?: string;
}

/** A link to a URL, opened in `target` (e.g. `_blank`). */
export interface UrlLink {
  url: string;
  target?: string;
}

export interface Option<T = unknown> {
  value: Scalar;
  label: string;
  /** The full object behind the option (a record), for rendering. */
  data?: T;
}

/** Where a picker's options come from: memory, the store, a server. */
export interface OptionsSource<T = unknown> {
  /** Options shown before any search. */
  load(signal: AbortSignal): Promise<readonly Option<T>[]>;
  /** Options matching typed text. Default: filter `load` by label. */
  search?(text: string, signal: AbortSignal): Promise<readonly Option<T>[]>;
  /** Options for values already set (chips for ids not loaded yet). */
  resolve?(
    values: readonly Scalar[],
    signal: AbortSignal,
  ): Promise<readonly Option<T>[]>;
}

/**
 * How a property is filtered. `editor` and `chip` are framework components;
 * the driver does not read them (the Ember layer types them).
 */
export interface FilterSpec<Rec = unknown, Editor = unknown, Chip = unknown> {
  /** Operators offered. Default: by field type (`operatorsFor`). */
  operators?: readonly OperatorId[];
  /** The operator a new condition starts with. Default: the first offered. */
  defaultOperator?: OperatorId;
  /** Edits one condition (operator + value). */
  editor?: Editor;
  /** Shows a set condition in a filter summary. */
  chip?: Chip;
  /** Picker options. Default: `field.options`. */
  options?: OptionsSource;
  /**
   * In-memory match, replacing the operator's own meaning: local search,
   * the memory backend. Negation and skipping still apply around it.
   */
  local?: (record: Rec, condition: ConditionNode) => boolean;
}

export interface PropertyExport<Rec = unknown> {
  /** Exported value. Default: the display value. */
  value?: (record: Rec) => unknown;
  /** Column title. Default: the label. */
  label?: string;
}

/** What `defineProperty` takes. */
export interface PropertyInput<Rec = unknown, Value = unknown> {
  /** Stable id: filter node ids, view config, URLs. Default: field.path. */
  key?: string;
  label: string;
  icon?: string;
  /** Query semantics: path, type, operators, options, nested fields. */
  field: FieldDefinition;
  /** Display read. Default: the value at field.path. */
  value?: (record: Rec) => Value;
  /** false = not sortable. Default: sorted on field.path. */
  sort?: false | { path?: FieldPath };
  /** false = not filterable. */
  filter?: false | FilterSpec<Rec>;
  views?: PropertyViews;
  /** Where a record links to: a URL, a URL with a target, or a route. */
  link?: (record: Rec) => string | UrlLink | RouteLink | undefined;
  /** false = left out of exports. */
  export?: false | PropertyExport<Rec>;
  /** App data the library never reads (a JSON schema, a template...). */
  meta?: Readonly<Record<string, unknown>>;
}

export type Property<Rec = unknown, Value = unknown> = Readonly<
  PropertyInput<Rec, Value> & { key: string }
>;

type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

/** What `extendProperty` takes: any part of a property, nested. */
export type PropertyOverrides<Rec = unknown, Value = unknown> = DeepPartial<
  PropertyInput<Rec, Value>
>;

// --- defining ---------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
};

/** Freezes plain objects and arrays; class instances (sources, components) stay as they are. */
function freezeData<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach(freezeData);
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach(freezeData);
    return Object.freeze(value);
  }
  return value;
}

function copyData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyData) as T;
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value))
      out[key] = copyData(entry);
    return out as T;
  }
  return value;
}

/**
 * Checks a property, fills `key` (field.path) and `field.label` (label),
 * and returns a frozen copy.
 */
export function defineProperty<Rec = unknown, Value = unknown>(
  input: PropertyInput<Rec, Value>,
): Property<Rec, Value> {
  if (!input.field?.path) throw new TypeError('A property needs field.path');
  const key = input.key ?? input.field.path;
  if (!key) throw new TypeError('A property needs a key');
  if (!input.label) throw new TypeError(`Property "${key}" needs a label`);
  const { filter } = input;
  if (filter && filter.defaultOperator && filter.operators) {
    if (!filter.operators.includes(filter.defaultOperator)) {
      throw new TypeError(
        `Property "${key}": defaultOperator "${filter.defaultOperator}" is not in operators`,
      );
    }
  }
  const property = copyData({
    ...input,
    key,
    field: { ...input.field, label: input.field.label ?? input.label },
  });
  return freezeData(property);
}

function merge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override))
      out[key] = merge(base[key], value);
    return out;
  }
  return override;
}

/**
 * A property with overrides merged in, deeply for plain objects (field,
 * filter, views...); anything else is replaced. A key that defaulted to
 * field.path follows a new field.path.
 */
export function extendProperty<Rec = unknown, Value = unknown>(
  input: AnyProperty<Rec, Value>,
  overrides: PropertyOverrides<Rec, Value>,
): Property<Rec, Value> {
  const base = toProperty(input);
  const merged = merge(base, overrides) as PropertyInput<Rec, Value>;
  const keyFollows =
    overrides.key === undefined &&
    overrides.field?.path !== undefined &&
    base.key === base.field.path;
  const labelFollows =
    overrides.label !== undefined &&
    overrides.field?.label === undefined &&
    base.field.label === base.label;
  return defineProperty({
    ...merged,
    ...(keyFollows ? { key: merged.field.path } : {}),
    field: {
      ...merged.field,
      ...(labelFollows ? { label: merged.label } : {}),
    },
  });
}

// --- reading ------------------------------------------------------------------

/** Plain property access along a dotted path. */
export function readPath(record: unknown, path: FieldPath): unknown {
  let value = record;
  for (const key of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** The display value: `value(record)`, or the value at field.path. */
export function propertyValue<Rec, Value>(
  input: AnyProperty<Rec, Value>,
  record: Rec,
  get: (record: Rec, path: FieldPath) => unknown = readPath,
): Value {
  const property = toProperty(input);
  return property.value
    ? property.value(record)
    : (get(record, property.field.path) as Value);
}

export const isSortable = (property: AnyProperty<never, unknown>) =>
  toProperty(property).sort !== false;

export const isFilterable = (property: AnyProperty<never, unknown>) =>
  toProperty(property).filter !== false;

export const isExportable = (property: AnyProperty<never, unknown>) =>
  toProperty(property).export !== false;

/** The path to sort on, or undefined when the property is not sortable. */
export function sortPath(
  input: AnyProperty<never, unknown>,
): FieldPath | undefined {
  const property = toProperty(input);
  if (property.sort === false) return undefined;
  return property.sort?.path ?? property.field.path;
}

/** The exported value: `export.value(record)`, or the display value. */
export function exportValue<Rec, Value>(
  input: AnyProperty<Rec, Value>,
  record: Rec,
  get?: (record: Rec, path: FieldPath) => unknown,
): unknown {
  const property = toProperty(input);
  const spec = property.export;
  if (spec && spec.value) return spec.value(record);
  return propertyValue(property, record, get);
}

const DEFAULT_OPERATORS: Record<string, readonly OperatorId[]> = {
  keyword: ['eq', 'in', 'exists'],
  text: ['contains', 'exists'],
  number: ['eq', 'range', 'exists'],
  date: ['range', 'eq', 'exists'],
  boolean: ['eq'],
  geo: ['exists'],
};
const KEYWORD_WITH_OPTIONS: readonly OperatorId[] = ['in', 'eq', 'exists'];

/** The operators a filter UI offers; empty when not filterable. */
export function operatorsFor(
  property: AnyProperty<never, unknown>,
): readonly OperatorId[] {
  const { filter, field } = toProperty(property);
  if (filter === false) return [];
  if (filter?.operators) return filter.operators;
  if (field.operators) return field.operators;
  const hasOptions = Boolean(field.options?.length || filter?.options);
  if (field.type === 'keyword' && hasOptions) return KEYWORD_WITH_OPTIONS;
  return DEFAULT_OPERATORS[field.type] ?? ['eq', 'exists'];
}

/** The operator a new condition on this property starts with. */
export function defaultOperator(
  property: AnyProperty<never, unknown>,
): OperatorId | undefined {
  const { filter } = toProperty(property);
  if (filter && filter.defaultOperator) return filter.defaultOperator;
  return operatorsFor(property)[0];
}

/** An OptionsSource over a fixed list; search matches labels, ignoring case. */
export function staticOptions<T = unknown>(
  options: readonly Option<T>[],
): OptionsSource<T> {
  const all = Object.freeze([...options]);
  return {
    load: () => Promise.resolve(all),
    search: (text) => {
      const needle = text.trim().toLowerCase();
      return Promise.resolve(
        needle
          ? all.filter((o) => o.label.toLowerCase().includes(needle))
          : all,
      );
    },
    resolve: (values) =>
      Promise.resolve(all.filter((o) => values.includes(o.value))),
  };
}

/** The property's options: `filter.options`, else `field.options`. */
export function optionsFor(
  property: AnyProperty<never, unknown>,
): OptionsSource | undefined {
  const { filter, field } = toProperty(property);
  if (filter === false) return undefined;
  if (filter?.options) return filter.options;
  return field.options ? staticOptions(field.options) : undefined;
}

// --- lists of properties ----------------------------------------------------------

/** The property with this key, else the first on this field path. */
export function findProperty<Rec, Value>(
  properties: readonly AnyProperty<Rec, Value>[],
  keyOrPath: string,
): Property<Rec, Value> | undefined {
  const all = properties.map((p) => toProperty(p));
  return (
    all.find((p) => p.key === keyOrPath) ??
    all.find((p) => p.field.path === keyOrPath)
  );
}

/**
 * The driver's field schema of the filterable properties, keyed by field
 * path. Properties sharing a path must agree on its type.
 */
export function schemaFrom(
  properties: readonly AnyProperty<never, unknown>[],
): FieldSchema {
  const schema: Record<FieldPath, FieldDefinition> = {};
  for (const property of properties) {
    const { field, key, filter } = toProperty(property);
    if (filter === false) continue;
    const known = schema[field.path];
    if (known) {
      if (known.type !== field.type) {
        throw new TypeError(
          `Property "${key}" types "${field.path}" as ${field.type}, another property as ${known.type}`,
        );
      }
      continue;
    }
    schema[field.path] = field;
  }
  return Object.freeze(schema);
}

/**
 * An evaluator `match` that runs each property's `filter.local` on
 * conditions on its field path. For the memory backend and local search.
 */
export function propertyMatcher(
  properties: readonly AnyProperty<never, unknown>[],
): NonNullable<EvaluateOptions['match']> {
  const local = new Map<
    FieldPath,
    (record: never, c: ConditionNode) => boolean
  >();
  for (const property of properties) {
    const { field, filter } = toProperty(property);
    if (filter && filter.local && !local.has(field.path))
      local.set(field.path, filter.local);
  }
  return (condition, doc, path) => local.get(path)?.(doc as never, condition);
}
