import type { FieldDefinition } from './codec.ts';
import { nodeToFilter } from './compat/search-ui.ts';
import {
  readPath,
  type Option,
  type OptionsSource,
  type Property,
  type RouteLink,
  type UrlLink,
} from './property.ts';
import type { SearchApiValueHooks } from './codecs/search-api.ts';
import type { ConditionNode, FieldPath, Scalar } from './types.ts';

// The legacy property shape: the mutable, class-based field descriptor that
// search-ui based apps have built their lists on. It is supported as a
// first-class input, for the long term: every API that takes properties
// takes legacy ones too, unchanged, and reads them live (class getters and
// setters included). `toProperty` turns one into a Property; the original
// stays at `meta.legacy`, so legacy components still receive the object
// they were written for.

/* eslint-disable @typescript-eslint/no-explicit-any -- the legacy shape is untyped by design */

/** A legacy filter editor: `component` gets `property`, `value`, `onChange`. */
export interface LegacyFilterComponentDefinition {
  component?: unknown;
  shouldShow?: (property: any) => boolean;
  args?: Record<string, unknown>;
}

/** A legacy value renderer: `component` gets `property`, `value`, `config`. */
export interface LegacyListValueDefinition {
  component: unknown;
  args?: Record<string, unknown>;
}

/** A legacy options collection (load, search and filter strategies). */
export interface LegacyCollection<T = any> {
  /** Loaded options (may start loading when read). */
  readonly options?: T[];
  load: () => Promise<T[]> | T[];
  /** Awaitable reload, when the collection has one. */
  loadAsync?: () => Promise<T[]>;
  search?: (options: T[], text: string) => Promise<T[]> | T[];
  filter?: (
    option: T,
    values: any[],
    opts?: { valueKey?: string },
  ) => Promise<boolean> | boolean;
  /** Fetches selected ids not loaded yet, when the collection can. */
  ensureLoadedForIds?: (ids: string[]) => Promise<void>;
}

/**
 * The legacy property shape. Every field stays supported; each one's
 * Property equivalent is named in its comment, for apps that want to move.
 */
export interface LegacyProperty {
  /** Column and filter title. Property: `label`. */
  name?: string;
  /** Display path. Property: `value`. */
  valuePath?: string;
  /** Export path. Property: `export.value`. */
  exportValuePath?: string;
  /** Filter path, default `valuePath`. Property: `field.path`. */
  filteredBy?: string;
  /** Sort path, default `valuePath`. Property: `sort.path`. */
  sortedBy?: string;
  /** Property: `filter: false`. */
  isFilterable?: boolean;
  /** Property: `sort: false`. */
  isSortable?: boolean;
  /** Read-only on legacy classes: `filteredBy && isFilterable !== false`. */
  readonly useFilter?: unknown;
  /** Property: `filter.editor` and `filter.chip`. */
  componentsForFiltering?: {
    filter?: LegacyFilterComponentDefinition;
    listValue?: LegacyListValueDefinition;
    listValues?: LegacyListValueDefinition;
  };
  /** A JSON schema for the field (its `type` and `format` give the field type). Property: `meta`. */
  property?: unknown;
  /** Picker options. Property: `filter.options`. */
  collection?: LegacyCollection;
  /** Per-view config; `iconType` is the icon. Property: `views` and `icon`. */
  // a union: an app's own views interface (no index signature) fits the
  // first member, a plain object literal with any view keys the second
  viewConfig?: { iconType?: string } | Record<string, unknown>;
  /** Route name read from the record. Property: `link`. */
  propertyRoute?: string;
  /** Route query read from the record. Property: `link`. */
  propertyQuery?: string;
  /** Route to `record.id`. Property: `link`. */
  routeName?: string;
  /** Route name. Property: `link`. */
  customRoute?: string;
  /** Paths of the route's dynamic segments. Property: `link`. */
  customRouteDynamicSeg?: string[] | string;
  /** Route query. Property: `link`. */
  query?: Record<string, unknown>;
  /** URL for a record. Property: `link`. */
  getUrl?: (record: any) => string | undefined;
  /** Target of `getUrl` links, default `_blank`. Property: `link`. */
  target?: string;
  /** Property: `meta`. */
  schemaTemplate?: unknown;
  /** Property: `meta`. */
  plainPropKey?: string;
  /** Property: `export: false`. */
  skipExport?: boolean;
  /** Wire value of one filter value. Property: the codec's `serializeValue`. */
  serialize?: (this: any, value: any) => any;
  /** The inverse of `serialize`. Property: the codec's `parseValue`. */
  deserialize?: (this: any, value: any) => any;
  /** In-memory match `(row, values, { valueKey })`. Property: `filter.local`. */
  localFilteringFunction?: (
    row: any,
    values: any[],
    opts: { valueKey?: string },
  ) => unknown;
}

/** A property in either shape. */
export type AnyProperty<Rec = unknown, Value = unknown> =
  Property<Rec, Value> | LegacyProperty;

export interface LegacyOptions {
  /** Reads a path from a record: Ember's `get` for proxies. Default: plain access. */
  get?: (record: any, path: FieldPath) => unknown;
  /**
   * The field type. Default: from the JSON schema in `property` (`type`,
   * `format`), else `keyword`.
   */
  fieldType?: (legacy: LegacyProperty) => FieldDefinition['type'] | undefined;
  /** Key of an option's value in a collection. Default `id`. */
  optionValueKey?: string;
  /** Key of an option's label in a collection. Default `name`. */
  optionLabelKey?: string;
}

/** Is this a legacy property (no `field` definition)? */
export function isLegacyProperty(
  property: AnyProperty<never, unknown>,
): property is LegacyProperty {
  const field = (property as { field?: unknown }).field;
  return !(
    typeof field === 'object' &&
    field !== null &&
    typeof (field as { path?: unknown }).path === 'string'
  );
}

// --- migration hints (opt-in) --------------------------------------------------

export interface LegacyNotice {
  /** `ember-search-ui.property.<field>` */
  id: string;
  /** The legacy field. */
  field: string;
  /** Its Property equivalent. */
  replacement: string;
  message: string;
}

const EQUIVALENTS: Record<string, string> = {
  name: 'label',
  valuePath: 'value',
  exportValuePath: 'export.value',
  filteredBy: 'field.path',
  sortedBy: 'sort.path',
  isFilterable: 'filter: false',
  isSortable: 'sort: false',
  componentsForFiltering: 'filter.editor / filter.chip',
  property: 'meta',
  collection: 'filter.options',
  viewConfig: 'views (and icon)',
  propertyRoute: 'link',
  propertyQuery: 'link',
  routeName: 'link',
  customRoute: 'link',
  customRouteDynamicSeg: 'link',
  query: 'link',
  getUrl: 'link',
  target: 'link',
  schemaTemplate: 'meta',
  plainPropKey: 'meta',
  skipExport: 'export: false',
  serialize: "the codec's serializeValue",
  deserialize: "the codec's parseValue",
  localFilteringFunction: 'filter.local',
};

let notify: ((notice: LegacyNotice) => void) | undefined;
const notified = new Set<string>();

/**
 * Migration hints: off by default. `true` logs each legacy field once
 * (console.info); a function receives the notices instead, e.g. to route
 * them to a framework's deprecation system.
 */
export function configureLegacyProperties(options: {
  hints?: boolean | ((notice: LegacyNotice) => void);
}): void {
  const { hints } = options;
  notify =
    hints === true
      ? (notice) => console.info(`[${notice.id}] ${notice.message}`)
      : hints || undefined;
  notified.clear();
}

function hint(legacy: LegacyProperty) {
  if (!notify) return;
  for (const [field, replacement] of Object.entries(EQUIVALENTS)) {
    if (notified.has(field)) continue;
    if ((legacy as Record<string, unknown>)[field] === undefined) continue;
    notified.add(field);
    notify({
      id: `ember-search-ui.property.${field}`,
      field,
      replacement,
      message: `Legacy property field "${field}" is supported; its Property equivalent is ${replacement}.`,
    });
  }
}

// --- reading a legacy property ---------------------------------------------------

/** The filter path, as legacy classes compute it. */
export const legacyFilterPath = (legacy: LegacyProperty) =>
  legacy.filteredBy || legacy.valuePath || legacy.exportValuePath || '';

const legacySortPath = (legacy: LegacyProperty) =>
  legacy.sortedBy || legacy.valuePath || '';

/** Filterable, as legacy classes compute `useFilter`. */
export function legacyUseFilter(legacy: LegacyProperty): boolean {
  if ('useFilter' in legacy) return Boolean(legacy.useFilter);
  return Boolean(legacyFilterPath(legacy)) && legacy.isFilterable !== false;
}

/** The field type from the property's JSON schema, if it has one. */
function schemaType(schema: unknown): FieldDefinition['type'] | undefined {
  if (typeof schema !== 'object' || schema === null) return undefined;
  const raw = (schema as { type?: unknown }).type;
  const type = Array.isArray(raw)
    ? (raw as unknown[]).find((t) => t !== 'null')
    : raw;
  const format = (schema as { format?: unknown }).format;
  if (type === 'string' && (format === 'date' || format === 'date-time'))
    return 'date';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  return undefined;
}

/** Values as the legacy filtering functions get them: one level flattened. */
const legacyValues = (condition: ConditionNode): unknown[] =>
  nodeToFilter(condition).values.flatMap((v): unknown[] =>
    Array.isArray(v) ? (v as unknown[]) : [v],
  );

/** The legacy table's link rules, in its order. */
function legacyLink(
  legacy: LegacyProperty,
  get: (record: any, path: FieldPath) => unknown,
): ((record: unknown) => string | UrlLink | RouteLink | undefined) | undefined {
  const routed = legacy.routeName || legacy.customRoute || legacy.propertyRoute;
  if (!routed && !legacy.getUrl) return undefined;
  return (record) => {
    if (legacy.routeName) {
      return {
        route: legacy.routeName,
        models: [get(record, 'id')],
      };
    }
    if (legacy.customRoute || legacy.propertyRoute) {
      const route =
        legacy.customRoute ?? (get(record, legacy.propertyRoute!) as string);
      if (!route) return undefined;
      const segments = legacy.customRouteDynamicSeg;
      let models: unknown[] = [];
      if (Array.isArray(segments)) {
        models = segments.map((path) => get(record, path)).filter((v) => v);
        // a missing segment means no link
        if (models.length !== segments.length) return undefined;
      } else if (segments) {
        models = [get(record, segments)];
      }
      const query =
        legacy.query ??
        (legacy.propertyQuery
          ? (get(record, legacy.propertyQuery) as Record<string, unknown>)
          : undefined);
      return { route, models, ...(query ? { query } : {}) };
    }
    const url = legacy.getUrl?.(record);
    return url ? { url, target: legacy.target ?? '_blank' } : undefined;
  };
}

/** A legacy collection as an OptionsSource. */
export function legacyOptions(
  collection: LegacyCollection,
  options: LegacyOptions = {},
): OptionsSource {
  const get = options.get ?? readPath;
  const valueKey = options.optionValueKey ?? 'id';
  const labelKey = options.optionLabelKey ?? 'name';
  const toOption = (item: unknown): Option => ({
    value: get(item, valueKey) as Scalar,
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    label: String(get(item, labelKey) ?? get(item, valueKey) ?? ''),
    data: item,
  });
  const loadItems = async (): Promise<unknown[]> => {
    const items: unknown[] = collection.loadAsync
      ? await collection.loadAsync()
      : await collection.load();
    return items;
  };
  return {
    load: async () => (await loadItems()).map(toOption),
    search: async (text) => {
      const items = await loadItems();
      if (collection.search)
        return (await collection.search(items, text)).map(toOption);
      const needle = text.trim().toLowerCase();
      return items
        .map(toOption)
        .filter((o) => !needle || o.label.toLowerCase().includes(needle));
    },
    resolve: async (values) => {
      await collection.ensureLoadedForIds?.(values.map(String));
      const all = (await loadItems()).map(toOption);
      return all.filter((o) =>
        values.some((v) => String(v) === String(o.value)),
      );
    },
  };
}

// --- normalizing -------------------------------------------------------------------

const SNAPSHOT_FIELDS = [
  'name',
  'valuePath',
  'exportValuePath',
  'filteredBy',
  'sortedBy',
  'isFilterable',
  'isSortable',
  'useFilter',
  'componentsForFiltering',
  'property',
  'collection',
  'viewConfig',
  'propertyRoute',
  'propertyQuery',
  'routeName',
  'customRoute',
  'customRouteDynamicSeg',
  'query',
  'getUrl',
  'target',
  'skipExport',
  'localFilteringFunction',
] as const;

const snapshot = (legacy: LegacyProperty) =>
  SNAPSHOT_FIELDS.map((field) => legacy[field]);

const DEFAULTS: LegacyOptions = {};
const caches = new WeakMap<
  LegacyOptions,
  WeakMap<object, { seen: unknown[]; property: Property<any, any> }>
>();

function convert(
  legacy: LegacyProperty,
  options: LegacyOptions,
): Property<any, any> {
  const get = options.get ?? readPath;
  const path = legacyFilterPath(legacy);
  // a column with no path (actions, buttons) still needs a key
  const key = path || `legacy:${legacy.name ?? 'column'}`;
  const filterable = legacyUseFilter(legacy) && Boolean(path);
  const sortPath = legacySortPath(legacy);
  const { iconType, ...views } = (legacy.viewConfig ?? {}) as {
    iconType?: string;
  } & Record<string, unknown>;
  const type =
    options.fieldType?.(legacy) ?? schemaType(legacy.property) ?? 'keyword';
  const local = legacy.localFilteringFunction;
  const link = legacyLink(legacy, get);
  const exportPath = legacy.exportValuePath || legacy.valuePath;

  const property: Property<any, any> = {
    key,
    label: legacy.name ?? key,
    ...(iconType ? { icon: iconType } : {}),
    field: { path: path || key, type, label: legacy.name ?? key },
    // read live, so later changes to the legacy object show
    ...(legacy.valuePath
      ? { value: (record: unknown) => get(record, legacy.valuePath!) }
      : {}),
    sort: legacy.isSortable === false || !sortPath ? false : { path: sortPath },
    filter: filterable
      ? {
          ...(legacy.collection
            ? { options: legacyOptions(legacy.collection, options) }
            : {}),
          ...(typeof local === 'function'
            ? {
                local: (record: unknown, condition: ConditionNode) =>
                  Boolean(
                    legacy.localFilteringFunction!(
                      record,
                      legacyValues(condition),
                      { valueKey: legacyFilterPath(legacy) },
                    ),
                  ),
              }
            : {}),
        }
      : false,
    views,
    ...(link ? { link } : {}),
    export: legacy.skipExport
      ? false
      : exportPath
        ? { value: (record: unknown) => get(record, exportPath) }
        : {},
    meta: Object.freeze({ legacy }),
  };
  return Object.freeze(property);
}

/**
 * A Property for either shape: a Property is returned as is; a legacy one
 * is converted (and cached until one of its fields changes). Functions on
 * the result read the legacy object live; the original is at `meta.legacy`.
 */
export function toProperty<Rec = unknown, Value = unknown>(
  property: AnyProperty<Rec, Value>,
  options: LegacyOptions = DEFAULTS,
): Property<Rec, Value> {
  if (!isLegacyProperty(property)) return property;
  const legacy = property;
  let cache = caches.get(options);
  if (!cache) caches.set(options, (cache = new WeakMap()));
  const seen = snapshot(legacy);
  const hit = cache.get(legacy);
  if (hit && hit.seen.every((value, i) => Object.is(value, seen[i])))
    return hit.property as Property<Rec, Value>;
  hint(legacy);
  const converted = convert(legacy, options);
  cache.set(legacy, { seen, property: converted });
  return converted as Property<Rec, Value>;
}

/** `toProperty` over a list. */
export function toProperties<Rec = unknown, Value = unknown>(
  properties: readonly AnyProperty<Rec, Value>[],
  options?: LegacyOptions,
): Property<Rec, Value>[] {
  return properties.map((p) => toProperty(p, options));
}

/** The legacy object behind a property, if it came from one. */
export function legacyOf(
  property: AnyProperty<never, unknown>,
): LegacyProperty | undefined {
  if (isLegacyProperty(property)) return property;
  const legacy = property.meta?.['legacy'];
  return typeof legacy === 'object' && legacy !== null ? legacy : undefined;
}

/**
 * The codec value hooks from legacy `serialize` / `deserialize`, matched by
 * filter path and called with the property as `this`, as before.
 */
export function legacyValueHooks(
  properties: readonly AnyProperty<never, unknown>[],
): Required<SearchApiValueHooks> {
  const find = (field: string, hook: 'serialize' | 'deserialize') =>
    properties
      .map((p) => legacyOf(p))
      .find((l) => l && legacyFilterPath(l) === field && l[hook]);
  return {
    serializeValue: (field, value) => {
      const legacy = find(field, 'serialize');
      return legacy
        ? (legacy.serialize!.call(legacy, value) as unknown)
        : value;
    },
    parseValue: (field, value) => {
      const legacy = find(field, 'deserialize');
      return legacy
        ? (legacy.deserialize!.call(legacy, value) as unknown)
        : value;
    },
  };
}
