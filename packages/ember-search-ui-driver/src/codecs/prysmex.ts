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
import type {
  ConditionNode,
  DateValue,
  FilterNode,
  RangeValue,
  Scalar,
  SearchState,
} from '../types.ts';

// Prysmex search requests. Two filter formats:
//
// - `list`: what the search-ui based Prysmex frontend sends today, an AND
//   of per-field entries: [{ field, values: [...] }]. A list of values means
//   "any of"; a single value is a scalar, { gt, gte, lt, lte } or { exists }.
// - `groups`: the documented Prysmex filter spec. Keys of one object are
//   ANDed; { type: 'any' | 'all', filters: [...] } groups nest; __negate and
//   __disable apply to objects and groups. Nested (per-item) queries are not
//   mapped yet.
//
// The request envelope is the same for both:
//   { search?, sort?, sort_direction?, page, per, filters, ...extensions }

export type PrysmexFilterList = {
  field: string;
  values: unknown[];
  type?: string;
}[];
export type PrysmexFilterObject = Record<string, unknown>;

export interface PrysmexRequest {
  search?: string;
  sort?: string;
  sort_direction?: 'asc' | 'desc';
  page?: number;
  per?: number;
  filters: PrysmexFilterList | PrysmexFilterObject;
  [extension: string]: unknown;
}

export interface PrysmexValueHooks {
  /**
   * Converts a value just before it is sent, e.g. Prysmex's
   * DocumentAdapterForQueryParams for `document.*` fields. In the list
   * format it gets each entry of `values`; in the groups format, the whole
   * value of the field.
   */
  serializeValue?: (field: string, value: unknown) => unknown;
  /** The inverse, applied when parsing a request or saved filter. */
  parseValue?: (field: string, value: unknown) => unknown;
}

export interface PrysmexCodecOptions extends PrysmexValueHooks {
  /** Filter format to send. Default `list` (what Prysmex sends today). */
  filters?: 'list' | 'groups';
  /**
   * Extensions starting with this prefix are added to the request without
   * it: `prysmex.include` -> `include`. Default `prysmex.`.
   */
  extensionsPrefix?: string;
  /** Keep disabled nodes as `__disable` (groups format), e.g. to save filters. */
  keepDisabled?: boolean;
}

const SUPPORTED_OPERATORS = ['eq', 'in', 'range', 'exists', 'contains'];
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
      // eq, contains
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
    throw new TypeError(
      `Unrecognised filter value for "${field}": ${JSON.stringify(wire)}`,
    );
  }
  return {
    operator: type === 'text' && typeof wire === 'string' ? 'contains' : 'eq',
    value: scalar(wire),
  };
}

function checkCondition(node: ConditionNode, ctx: CodecContext): Support {
  if (!SUPPORTED_OPERATORS.includes(node.operator)) {
    return refuse(node, `Prysmex filters have no "${node.operator}" operator`);
  }
  const type = ctx.schema?.[node.field]?.type;
  // Prysmex reads a bare string as "contains" on text fields and "equals"
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

/** The search-ui style list Prysmex sends today: an AND of per-field entries. */
export function prysmexListFilters(
  hooks: PrysmexValueHooks = {},
): FilterCodec<PrysmexFilterList> {
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
      const list: PrysmexFilterList = [];
      const visit = (node: FilterNode) => {
        if (node.kind === 'group') node.children.forEach(visit);
        else if (node.kind === 'condition') {
          const wire = encodeCondition(node, 'object');
          // like the search-ui based frontend: hooks see one entry of `values` at a time
          const values = (
            Array.isArray(wire) ? (wire as unknown[]) : [wire]
          ).map((v): unknown =>
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
          return {
            kind: 'condition',
            id:
              n === 1 ? `filter:${entry.field}` : `filter:${entry.field}:${n}`,
            field: entry.field,
            ...decodeValue(entry.field, wire, ctx),
          };
        });
      return { kind: 'group', id: ROOT_ID, op: 'and', children };
    },
  };
}

// --- groups format ----------------------------------------------------------------

const FLAG_KEYS = ['__negate', '__disable'];

/** The documented Prysmex filter spec (objects, groups, __negate, __disable). */
export function prysmexGroupFilters(
  hooks: PrysmexValueHooks & { keepDisabled?: boolean } = {},
): FilterCodec<PrysmexFilterObject> {
  const supports = (node: FilterNode, ctx: CodecContext): Support => {
    if (node.disabled && !hooks.keepDisabled) return ok;
    switch (node.kind) {
      case 'nested':
        return refuse(node, 'Nested queries are not mapped to Prysmex yet');
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

  const encode = (node: FilterNode): PrysmexFilterObject => {
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
        'Nested queries are not mapped to Prysmex yet',
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
      ) as PrysmexFilterObject;
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
          throw new TypeError('A Prysmex filter must be an object');
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

export interface PrysmexCodec extends StateCodec<PrysmexRequest> {
  readonly filterCodec:
    FilterCodec<PrysmexFilterList> | FilterCodec<PrysmexFilterObject>;
  /** Can the active filter format express this node? For UIs. */
  supports(node: FilterNode, ctx: CodecContext): Support;
  parse(request: PrysmexRequest, ctx: CodecContext): SearchState;
}

export function prysmexCodec(options: PrysmexCodecOptions = {}): PrysmexCodec {
  const prefix = options.extensionsPrefix ?? 'prysmex.';
  const list = prysmexListFilters(options);
  const groups = prysmexGroupFilters(options);
  const filterCodec = options.filters === 'groups' ? groups : list;

  return {
    filterCodec,
    supports: (node, ctx) => filterCodec.supports(node, ctx),

    serialize(state, ctx) {
      if (state.page.kind !== 'offset') {
        throw new TypeError('Prysmex searches use page/per, not cursors');
      }
      const request: PrysmexRequest = {
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
}

/** Values on the wire, for typing hooks. */
export type PrysmexWireValue =
  Scalar | Scalar[] | RangeValue | { exists: boolean } | null;

// --- backend ------------------------------------------------------------------

export interface PrysmexResponse {
  /** Records, already pushed/converted by the client (e.g. the store). */
  results?: unknown[];
  /** JSON:API data, used when `results` is absent. */
  data?: unknown[];
  meta?: { total_count?: number; total_pages?: number; [key: string]: unknown };
}

export interface PrysmexBackendOptions extends PrysmexCodecOptions {
  /**
   * Sends the request: your fetch service, the endpoint, auth, pushing the
   * payload into the store... Honour `signal` to cancel superseded searches.
   */
  request: (
    request: PrysmexRequest,
    signal: AbortSignal,
  ) => Promise<PrysmexResponse>;
}

/** A driver backend for Prysmex search endpoints. */
export function prysmexBackend<Doc = unknown>(
  options: PrysmexBackendOptions,
): Backend<PrysmexRequest, PrysmexResponse, Doc> {
  return {
    codec: prysmexCodec(options),
    search: (request, signal) => options.request(request, signal),
    normalize: (response) => {
      const { total_count, total_pages, ...rest } = response.meta ?? {};
      // the client decides what records look like (e.g. store models)
      const results = (response.results ?? response.data ?? []) as Doc[];
      return {
        results,
        total: total_count ?? results.length,
        ...(total_pages !== undefined ? { pageCount: total_pages } : {}),
        aggregations: rest, // e.g. project_counts
      };
    },
  };
}
