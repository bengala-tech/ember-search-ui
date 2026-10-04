import {
  UnsupportedNodeError,
  type Backend,
  type CodecContext,
  type FilterCodec,
  type StateCodec,
  type Support,
} from '../codec.ts';
import { isDateValue } from '../operators.ts';
import { prune } from '../normalize.ts';
import { createState } from '../state.ts';
import { ROOT_ID } from '../tree.ts';
import { withPaths, type PathMap } from '../paths.ts';
import { ARRAY_VALUE_META, isArrayValue } from '../compat/search-ui.ts';
import type {
  ConditionNode,
  DateValue,
  FilterNode,
  RangeValue,
  Scalar,
  SearchState,
} from '../types.ts';

// Requests for a JSON search API (page/per, sort/sort_direction, filters).
// Two filter formats:
//
// - `list`: the legacy format a search-ui based frontend sends, an AND
//   of per-field entries: [{ field, values: [...] }]. A list of values means
//   "any of"; a single value is a scalar, { gt, gte, lt, lte } or { exists }.
// - `groups`: the newer filter spec. Keys of one object are
//   ANDed; { type: 'any' | 'all', filters: [...] } groups nest; __negate and
//   __disable apply to objects and groups. Nested (per-item) queries are not
//   mapped yet.
//
// The request envelope is the same for both:
//   { search?, sort?, sort_direction?, page, per, filters, ...extensions }

export type SearchApiFilterList = {
  field: string;
  values: unknown[];
  type?: string;
}[];
export type SearchApiFilterObject = Record<string, unknown>;

export interface SearchApiRequest {
  search?: string;
  sort?: string;
  sort_direction?: 'asc' | 'desc';
  page?: number;
  per?: number;
  filters: SearchApiFilterList | SearchApiFilterObject;
  [extension: string]: unknown;
}

export interface SearchApiValueHooks {
  /**
   * Converts a value just before it is sent, e.g. an app's own value
   * adapter for some fields. In the list
   * format it gets each entry of `values`; in the groups format, the whole
   * value of the field.
   */
  serializeValue?: (field: string, value: unknown) => unknown;
  /** The inverse, applied when parsing a request or saved filter. */
  parseValue?: (field: string, value: unknown) => unknown;
}

export interface SearchApiCodecOptions extends SearchApiValueHooks {
  /** Filter format to send. Default `list` (the legacy format). */
  filters?: 'list' | 'groups';
  /**
   * Extensions starting with this prefix are added to the request without
   * it: `api.include` -> `include`. Default `api.`.
   */
  extensionsPrefix?: string;
  /** Keep disabled nodes as `__disable` (groups format), e.g. to save filters. */
  keepDisabled?: boolean;
  /**
   * The backend's names for fields: `{ createdAt: 'created_at' }` or a
   * function. Filters, sorts and search fields are renamed when sent; a
   * table is also inverted when parsing. See `withPaths`.
   */
  paths?: PathMap;
  /** Sort fields only, before `paths`: `{ 'project.name': 'project.name.raw' }`. */
  sortPaths?: PathMap;
  /** Backend -> app names when parsing, for a function `paths`. */
  parsePaths?: PathMap;
}

const SUPPORTED_OPERATORS = ['eq', 'in', 'range', 'exists', 'contains', 'raw'];
const RANGE_KEYS = ['gt', 'gte', 'lt', 'lte'];

const ok: Support = { ok: true };
const refuse = (node: FilterNode, reason: string): Support => ({
  ok: false,
  nodeId: node.id,
  reason,
});

// --- values ---------------------------------------------------------------

const encodeDate = (value: unknown) =>
  isDateValue(value) ? ('date' in value ? value.date : value.dateMath) : value;

/** The wire value of one condition (before hooks). */
function encodeCondition(
  node: ConditionNode,
  missingAs: 'object' | 'null',
): unknown {
  const value = node.value;
  switch (node.operator) {
    case 'in':
      return (value as Scalar[]).map(encodeDate);
    case 'range': {
      const out: Record<string, unknown> = {};
      for (const [key, bound] of Object.entries(value as RangeValue)) {
        out[key] = encodeDate(bound);
      }
      return out;
    }
    case 'exists':
      if (value === true) return { exists: true };
      return missingAs === 'null' ? null : { exists: false };
    default:
      // eq, contains, raw
      return encodeDate(value);
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A wire value back to operator + value, using the field schema for types. */
function decodeValue(
  field: string,
  wire: unknown,
  ctx: CodecContext,
): Pick<ConditionNode, 'operator' | 'value'> {
  const type = ctx.schema?.[field]?.type;
  const scalar = (v: unknown): Scalar | DateValue => {
    if (type === 'date' && typeof v === 'string') {
      return v.startsWith('now') || v.includes('||')
        ? { dateMath: v }
        : { date: v };
    }
    return v as Scalar;
  };

  if (wire === null) return { operator: 'exists', value: false };
  if (Array.isArray(wire)) {
    const primitive = wire.every((v) =>
      ['string', 'number', 'boolean'].includes(typeof v),
    );
    // e.g. a list of objects: kept as is
    if (!primitive) return { operator: 'raw', value: wire as Scalar[] };
    return { operator: 'in', value: wire.map(scalar) };
  }
  if (isPlainObject(wire)) {
    const keys = Object.keys(wire);
    if (keys.length === 1 && keys[0] === 'exists') {
      return { operator: 'exists', value: Boolean(wire['exists']) };
    }
    if (keys.length > 0 && keys.every((k) => RANGE_KEYS.includes(k))) {
      const range: Record<string, unknown> = {};
      for (const key of keys) range[key] = scalar(wire[key]);
      return { operator: 'range', value: range };
    }
    // a shape the driver has no operator for: kept as is
    return { operator: 'raw', value: wire };
  }
  return {
    operator: type === 'text' && typeof wire === 'string' ? 'contains' : 'eq',
    value: scalar(wire),
  };
}

function checkCondition(node: ConditionNode, ctx: CodecContext): Support {
  if (!SUPPORTED_OPERATORS.includes(node.operator)) {
    return refuse(node, `The search API has no "${node.operator}" operator`);
  }
  const type = ctx.schema?.[node.field]?.type;
  // The API reads a bare string as "contains" on text fields and "equals"
  // elsewhere, so each operator only fits one kind of field.
  if (node.operator === 'eq' && type === 'text') {
    return refuse(node, `"is" on a text field is sent as "contains"`);
  }
  if (node.operator === 'contains' && type !== undefined && type !== 'text') {
    return refuse(
      node,
      `"contains" needs a text field ("${node.field}" is ${type})`,
    );
  }
  return ok;
}

// --- list format --------------------------------------------------------------

/** The legacy search-ui style list: an AND of per-field entries. */
export function searchApiListFilters(
  hooks: SearchApiValueHooks = {},
): FilterCodec<SearchApiFilterList> {
  const supports = (node: FilterNode, ctx: CodecContext): Support => {
    if (node.disabled) return ok; // dropped
    if (node.negate) return refuse(node, 'The list format cannot negate');
    switch (node.kind) {
      case 'nested':
        return refuse(node, 'The list format has no nested queries');
      case 'group': {
        const active = prune({ ...node, id: ROOT_ID }, ctx.operators).children;
        if (node.op === 'or' && active.length > 1) {
          return refuse(node, 'The list format can only AND conditions');
        }
        for (const child of node.children) {
          const support = supports(child, ctx);
          if (!support.ok) return support;
        }
        return ok;
      }
      case 'condition':
        return checkCondition(node, ctx);
    }
  };

  return {
    supports,

    serialize(filter, ctx) {
      const support = supports(filter, ctx);
      if (!support.ok)
        throw new UnsupportedNodeError(support.nodeId, support.reason);
      const list: SearchApiFilterList = [];
      const visit = (node: FilterNode) => {
        if (node.kind === 'group') node.children.forEach(visit);
        else if (node.kind === 'condition') {
          const wire = encodeCondition(node, 'object');
          // like the search-ui based frontend: hooks see one entry of `values`
          // at a time. A one-array value (older search-ui) stays one entry.
          const entries = isArrayValue(node)
            ? [Array.isArray(wire) ? wire : [wire]]
            : Array.isArray(wire)
              ? (wire as unknown[])
              : [wire];
          const values = entries.map((v): unknown =>
            hooks.serializeValue ? hooks.serializeValue(node.field, v) : v,
          );
          list.push({ field: node.field, values });
        }
      };
      visit(prune(filter, ctx.operators));
      return list;
    },

    parse(list, ctx) {
      const counts = new Map<string, number>();
      const children = list
        .filter((entry) => entry.values.length > 0)
        .map((entry): ConditionNode => {
          const n = (counts.get(entry.field) ?? 0) + 1;
          counts.set(entry.field, n);
          const values = entry.values.map((v) =>
            hooks.parseValue ? hooks.parseValue(entry.field, v) : v,
          );
          // several values (or a nested list) = "any of"
          const wire = values.length === 1 ? values[0] : values;
          const nested = values.length === 1 && Array.isArray(values[0]);
          return {
            kind: 'condition',
            id:
              n === 1 ? `filter:${entry.field}` : `filter:${entry.field}:${n}`,
            field: entry.field,
            ...decodeValue(entry.field, wire, ctx),
            ...(nested ? { meta: { [ARRAY_VALUE_META]: true } } : {}),
          };
        });
      return { kind: 'group', id: ROOT_ID, op: 'and', children };
    },
  };
}

// --- groups format ----------------------------------------------------------------

const FLAG_KEYS = ['__negate', '__disable'];

/** The groups filter spec (objects, groups, __negate, __disable). */
export function searchApiGroupFilters(
  hooks: SearchApiValueHooks & { keepDisabled?: boolean } = {},
): FilterCodec<SearchApiFilterObject> {
  const supports = (node: FilterNode, ctx: CodecContext): Support => {
    if (node.disabled && !hooks.keepDisabled) return ok;
    switch (node.kind) {
      case 'nested':
        return refuse(
          node,
          'Nested queries are not mapped to the search API yet',
        );
      case 'group':
        for (const child of node.children) {
          const support = supports(child, ctx);
          if (!support.ok) return support;
        }
        return ok;
      case 'condition':
        return checkCondition(node, ctx);
    }
  };

  const flags = (node: FilterNode) => ({
    ...(node.negate ? { __negate: true } : {}),
    ...(node.disabled ? { __disable: true } : {}),
  });

  const encode = (node: FilterNode): SearchApiFilterObject => {
    if (node.kind === 'condition') {
      const wire = encodeCondition(node, 'null');
      return {
        ...flags(node),
        [node.field]: hooks.serializeValue
          ? hooks.serializeValue(node.field, wire)
          : wire,
      };
    }
    if (node.kind === 'nested') {
      throw new UnsupportedNodeError(
        node.id,
        'Nested queries are not mapped to the search API yet',
      );
    }
    // A group of one, without flags of its own, is just its child.
    if (node.children.length === 1 && !node.negate && !node.disabled) {
      return encode(node.children[0]!);
    }
    // An AND of plain conditions on distinct fields is one object.
    const plain = node.children.every(
      (c) => c.kind === 'condition' && !c.negate && !c.disabled,
    );
    const fields = node.children.map((c) =>
      c.kind === 'condition' ? c.field : '',
    );
    if (node.op === 'and' && plain && new Set(fields).size === fields.length) {
      return Object.assign(
        { ...flags(node) },
        ...node.children.map(encode),
      ) as SearchApiFilterObject;
    }
    return {
      ...flags(node),
      type: node.op === 'and' ? 'all' : 'any',
      filters: node.children.map(encode),
    };
  };

  return {
    supports,

    serialize(filter, ctx) {
      const support = supports(filter, ctx);
      if (!support.ok)
        throw new UnsupportedNodeError(support.nodeId, support.reason);
      const tree = hooks.keepDisabled ? filter : prune(filter, ctx.operators);
      return encode(tree);
    },

    parse(external, ctx) {
      let next = 0;
      const id = () => `p${++next}`;
      const decode = (raw: unknown): FilterNode => {
        if (!isPlainObject(raw))
          throw new TypeError('A groups filter must be an object');
        const flagged = {
          ...(raw['__negate'] === true ? { negate: true } : {}),
          ...(raw['__disable'] === true ? { disabled: true } : {}),
        };
        if (Array.isArray(raw['filters'])) {
          return {
            kind: 'group',
            id: id(),
            op: raw['type'] === 'any' ? 'or' : 'and',
            children: raw['filters'].map(decode),
            ...flagged,
          };
        }
        const keys = Object.keys(raw).filter((k) => !FLAG_KEYS.includes(k));
        const conditions = keys.map((field): ConditionNode => {
          const wire = hooks.parseValue
            ? hooks.parseValue(field, raw[field])
            : raw[field];
          return {
            kind: 'condition',
            id: id(),
            field,
            ...decodeValue(field, wire, ctx),
          };
        });
        if (conditions.length === 1) return { ...conditions[0]!, ...flagged };
        return {
          kind: 'group',
          id: id(),
          op: 'and',
          children: conditions,
          ...flagged,
        };
      };

      const node = decode(external);
      return node.kind === 'group'
        ? { ...node, id: ROOT_ID }
        : { kind: 'group', id: ROOT_ID, op: 'and', children: [node] };
    },
  };
}

// --- whole request ------------------------------------------------------------------

export interface SearchApiCodec extends StateCodec<SearchApiRequest> {
  readonly filterCodec:
    FilterCodec<SearchApiFilterList> | FilterCodec<SearchApiFilterObject>;
  /** Can the active filter format express this node? For UIs. */
  supports(node: FilterNode, ctx: CodecContext): Support;
  parse(request: SearchApiRequest, ctx: CodecContext): SearchState;
}

export function searchApiCodec(
  options: SearchApiCodecOptions = {},
): SearchApiCodec {
  const prefix = options.extensionsPrefix ?? 'api.';
  const list = searchApiListFilters(options);
  const groups = searchApiGroupFilters(options);
  const filterCodec = options.filters === 'groups' ? groups : list;

  const codec: SearchApiCodec = {
    filterCodec,
    supports: (node, ctx) => filterCodec.supports(node, ctx),

    serialize(state, ctx) {
      if (state.page.kind !== 'offset') {
        throw new TypeError('The search API uses page/per, not cursors');
      }
      const request: SearchApiRequest = {
        filters: filterCodec.serialize(state.filter, ctx),
        page: state.page.page,
        per: state.page.perPage,
      };
      if (state.query.term) request.search = state.query.term;
      const [sort] = state.sort;
      if (sort) {
        request.sort = sort.field;
        request.sort_direction = sort.direction;
      }
      for (const [key, value] of Object.entries(state.extensions)) {
        if (key.startsWith(prefix) && value !== undefined) {
          request[key.slice(prefix.length)] = value;
        }
      }
      return request;
    },

    parse(request, ctx) {
      const { search, sort, sort_direction, page, per, filters, ...rest } =
        request;
      const filter = Array.isArray(filters)
        ? list.parse!(filters, ctx)
        : groups.parse!(filters ?? {}, ctx);
      const extensions: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest))
        extensions[`${prefix}${key}`] = value;
      const defaults = createState();
      return {
        query: { term: search ?? '' },
        filter,
        sort: sort
          ? [
              {
                field: sort,
                direction: sort_direction === 'asc' ? 'asc' : 'desc',
              },
            ]
          : [],
        page: {
          kind: 'offset',
          page: Number(page ?? 1),
          perPage: Number(
            per ??
              (defaults.page.kind === 'offset' ? defaults.page.perPage : 20),
          ),
        },
        extensions,
      };
    },
  };
  if (!options.paths && !options.sortPaths) return codec;
  const renamed = withPaths(codec, {
    paths: options.paths ?? {},
    ...(options.sortPaths ? { sort: options.sortPaths } : {}),
    ...(options.parsePaths ? { parse: options.parsePaths } : {}),
  });
  return {
    ...codec,
    serialize: (state, ctx) => renamed.serialize(state, ctx),
    parse: (request, ctx) => renamed.parse!(request, ctx),
  };
}

/** Values on the wire, for typing hooks. */
export type SearchApiWireValue =
  Scalar | Scalar[] | RangeValue | { exists: boolean } | null;

// --- backend ------------------------------------------------------------------

export interface SearchApiResponse {
  /** Records, already pushed/converted by the client (e.g. the store). */
  results?: unknown[];
  /** JSON:API data, used when `results` is absent. */
  data?: unknown[];
  meta?: { total_count?: number; total_pages?: number; [key: string]: unknown };
}

export interface SearchApiBackendOptions extends SearchApiCodecOptions {
  /**
   * Sends the request: your fetch service, the endpoint, auth, pushing the
   * payload into the store... Honour `signal` to cancel superseded searches.
   */
  request: (
    request: SearchApiRequest,
    signal: AbortSignal,
  ) => Promise<SearchApiResponse>;
}

/** A driver backend for search API endpoints. */
export function searchApiBackend<Doc = unknown>(
  options: SearchApiBackendOptions,
): Backend<SearchApiRequest, SearchApiResponse, Doc> {
  return {
    codec: searchApiCodec(options),
    search: (request, signal) => options.request(request, signal),
    normalize: (response) => {
      const { total_count, total_pages, ...rest } = response.meta ?? {};
      // the client decides what records look like (e.g. store models)
      const results = (response.results ?? response.data ?? []) as Doc[];
      return {
        results,
        total: total_count ?? results.length,
        ...(total_pages !== undefined ? { pageCount: total_pages } : {}),
        aggregations: rest, // e.g. status_counts
      };
    },
  };
}
