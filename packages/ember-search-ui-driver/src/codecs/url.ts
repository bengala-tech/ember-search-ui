import type { CodecContext, StateCodec } from '../codec.ts';
import { createState } from '../state.ts';
import { ROOT_ID, collectIds } from '../tree.ts';
import type {
  FilterNode,
  FilterValue,
  GroupNode,
  SearchState,
  SortItem,
} from '../types.ts';

// The search state as query-string parameters. Only values that differ from
// `defaults` are written, so an untouched search leaves the URL clean:
//
//   q       query term                      ?q=zion
//   qf      query fields, comma-separated   ?qf=title,description
//   f       filter tree, compact JSON       ?f=["g","root","","and",[["c","n1","","x","eq","b"]]]
//   sort    fields, "-" = descending        ?sort=-visitors,title
//   page    page number (offset paging)     ?page=3
//   per     page size (offset paging)       ?per=50
//   cursor  cursor (cursor paging)          ?cursor=abc
//   size    page size (cursor paging)       ?size=50
//   x       extensions, JSON (opt-in)       ?x={"prysmex.refresh":true}
//
// Compact filter nodes keep ids, negation and disabled flags, so the tree
// round-trips exactly:
//
//   ["c", id, flags, field, operator, value?]   (no value slot = no value yet)
//   ["g", id, flags, "and" | "or", [children]]
//   ["n", id, flags, path, "some" | "every" | "none", groupNode]
//   {"meta": {...}, "node": <one of the above>}  when the node has meta
//
// flags: "!" = negated, "-" = disabled ("!-" = both), "" = neither.

export interface UrlCodecOptions {
  /** Prefix for every parameter, to keep several searches on one page apart. */
  prefix?: string;
  /** Values that are not written to the URL. Default: a fresh state. */
  defaults?: SearchState;
  /** Also store `extensions` (param `x`). Default false. */
  extensions?: boolean;
  /** Also store node `meta` (UI data such as owners). Default true. */
  meta?: boolean;
  /** Called with each parameter that could not be parsed (and was ignored). */
  onInvalid?: (param: string, error: unknown) => void;
}

export interface UrlCodec extends StateCodec<string> {
  /** The parameter names this codec reads and writes. */
  readonly params: readonly string[];
  /** Is `name` one of this codec's parameters? */
  owns(name: string): boolean;
  /** Parses the given query string (with or without "?"). Never throws. */
  parse(search: string, ctx?: CodecContext): SearchState;
  /** Query string with this codec's parameters only, without "?". */
  serialize(state: SearchState, ctx?: CodecContext): string;
}

const PARAMS = ['q', 'qf', 'f', 'sort', 'page', 'per', 'cursor', 'size', 'x'];

export function urlCodec(options: UrlCodecOptions = {}): UrlCodec {
  const prefix = options.prefix ?? '';
  const defaults = options.defaults ?? createState();
  const withMeta = options.meta ?? true;
  const name = (param: string) => `${prefix}${param}`;
  const params = PARAMS.filter((p) => p !== 'x' || options.extensions).map(
    name,
  );

  return {
    params,

    owns: (param) => params.includes(param),

    serialize(state) {
      const out = new URLSearchParams();
      const set = (param: string, value: string) => out.set(name(param), value);

      if (state.query.term !== defaults.query.term) set('q', state.query.term);
      if (!sameJson(state.query.fields, defaults.query.fields)) {
        set('qf', (state.query.fields ?? []).join(','));
      }
      if (!sameJson(state.filter, defaults.filter)) {
        set('f', JSON.stringify(encodeNode(state.filter, withMeta)));
      }
      if (!sameJson(state.sort, defaults.sort))
        set('sort', encodeSort(state.sort));

      const page = state.page;
      const base = defaults.page;
      if (page.kind === 'offset') {
        if (page.page !== 1) set('page', String(page.page));
        if (base.kind !== 'offset' || page.perPage !== base.perPage) {
          set('per', String(page.perPage));
        }
      } else {
        if (page.cursor !== null) set('cursor', page.cursor);
        if (base.kind !== 'cursor' || page.size !== base.size) {
          set('size', String(page.size));
        }
      }

      if (
        options.extensions &&
        !sameJson(state.extensions, defaults.extensions)
      ) {
        set('x', JSON.stringify(state.extensions));
      }
      return out.toString();
    },

    parse(search) {
      const input = new URLSearchParams(
        search.startsWith('?') ? search.slice(1) : search,
      );
      const get = (param: string) => input.get(name(param));
      const read = <T>(
        param: string,
        fallback: T,
        decode: (raw: string) => T,
      ): T => {
        const raw = get(param);
        if (raw === null) return fallback;
        try {
          return decode(raw);
        } catch (error) {
          options.onInvalid?.(name(param), error);
          return fallback;
        }
      };

      const term = get('q') ?? defaults.query.term;
      const fields = read('qf', defaults.query.fields, (raw) =>
        raw === '' ? [] : raw.split(','),
      );
      const filter = read('f', defaults.filter, (raw) =>
        decodeRoot(JSON.parse(raw)),
      );
      const sort = read('sort', defaults.sort, decodeSort);

      const base = defaults.page;
      let page: SearchState['page'];
      if (
        base.kind === 'cursor' ||
        get('cursor') !== null ||
        get('size') !== null
      ) {
        page = {
          kind: 'cursor',
          cursor: get('cursor') ?? null,
          size: read(
            'size',
            base.kind === 'cursor' ? base.size : 20,
            positiveInt,
          ),
        };
      } else {
        page = {
          kind: 'offset',
          page: read('page', 1, positiveInt),
          perPage: read('per', base.perPage, positiveInt),
        };
      }

      const extensions = options.extensions
        ? read('x', defaults.extensions, (raw) => {
            const value: unknown = JSON.parse(raw);
            if (!isPlainObject(value))
              throw new TypeError('x must be an object');
            return value;
          })
        : defaults.extensions;

      return {
        query: fields === undefined ? { term } : { term, fields },
        filter,
        sort,
        page,
        extensions,
      };
    },
  };
}

// --- filter tree ------------------------------------------------------------

function encodeNode(node: FilterNode, withMeta: boolean): unknown {
  const flags = `${node.negate ? '!' : ''}${node.disabled ? '-' : ''}`;
  let compact: unknown[];
  switch (node.kind) {
    case 'condition':
      compact = ['c', node.id, flags, node.field, node.operator];
      if (node.value !== undefined) compact.push(node.value);
      break;
    case 'group':
      compact = [
        'g',
        node.id,
        flags,
        node.op,
        node.children.map((c) => encodeNode(c, withMeta)),
      ];
      break;
    case 'nested':
      compact = [
        'n',
        node.id,
        flags,
        node.path,
        node.quantifier,
        encodeNode(node.filter, withMeta),
      ];
      break;
  }
  return withMeta && node.meta ? { meta: node.meta, node: compact } : compact;
}

function decodeRoot(raw: unknown): GroupNode {
  const root = decodeNode(raw);
  if (root.kind !== 'group' || root.id !== ROOT_ID) {
    throw new TypeError(`The filter must be a group with id "${ROOT_ID}"`);
  }
  collectIds(root); // throws on duplicate ids
  return root;
}

function decodeNode(raw: unknown): FilterNode {
  if (isPlainObject(raw)) {
    if (!isPlainObject(raw['meta'])) throw new TypeError('Invalid meta');
    return { ...decodeNode(raw['node']), meta: raw['meta'] };
  }
  if (!Array.isArray(raw)) throw new TypeError('A node must be an array');
  const [kind, id, flags] = raw as unknown[];
  if (typeof id !== 'string' || id === '')
    throw new TypeError('A node needs an id');
  if (typeof flags !== 'string' || !/^!?-?$/.test(flags)) {
    throw new TypeError(`Invalid flags on "${id}"`);
  }
  const base = {
    id,
    ...(flags.includes('!') ? { negate: true } : {}),
    ...(flags.includes('-') ? { disabled: true } : {}),
  };

  switch (kind) {
    case 'c': {
      const [, , , field, operator] = raw as unknown[];
      if (
        typeof field !== 'string' ||
        typeof operator !== 'string' ||
        raw.length > 6
      ) {
        throw new TypeError(`Invalid condition "${id}"`);
      }
      return raw.length === 6
        ? {
            kind: 'condition',
            ...base,
            field,
            operator,
            value: raw[5] as FilterValue,
          }
        : { kind: 'condition', ...base, field, operator };
    }
    case 'g': {
      const [, , , op, children] = raw as unknown[];
      if ((op !== 'and' && op !== 'or') || !Array.isArray(children)) {
        throw new TypeError(`Invalid group "${id}"`);
      }
      return { kind: 'group', ...base, op, children: children.map(decodeNode) };
    }
    case 'n': {
      const [, , , path, quantifier, filter] = raw as unknown[];
      const inner = decodeNode(filter);
      if (
        typeof path !== 'string' ||
        (quantifier !== 'some' &&
          quantifier !== 'every' &&
          quantifier !== 'none') ||
        inner.kind !== 'group'
      ) {
        throw new TypeError(`Invalid nested node "${id}"`);
      }
      return { kind: 'nested', ...base, path, quantifier, filter: inner };
    }
    default:
      throw new TypeError(`Unknown node kind ${JSON.stringify(kind)}`);
  }
}

// --- sort -------------------------------------------------------------------

function encodeSort(sort: readonly SortItem[]): string {
  // fields that would be ambiguous in the short form fall back to JSON
  if (
    sort.some(
      ({ field }) =>
        field === '' ||
        field.includes(',') ||
        field.startsWith('-') ||
        field.startsWith('['),
    )
  ) {
    return JSON.stringify(
      sort.map(({ field, direction }) => [field, direction]),
    );
  }
  return sort
    .map(({ field, direction }) => (direction === 'desc' ? `-${field}` : field))
    .join(',');
}

function decodeSort(raw: string): SortItem[] {
  if (raw.startsWith('[')) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new TypeError('sort must be a list');
    return parsed.map((raw: unknown) => {
      const item = raw as unknown[];
      if (
        !Array.isArray(item) ||
        typeof item[0] !== 'string' ||
        (item[1] !== 'asc' && item[1] !== 'desc')
      ) {
        throw new TypeError('Invalid sort item');
      }
      return { field: item[0], direction: item[1] };
    });
  }
  if (raw === '') return [];
  return raw.split(',').map((part) => {
    if (part === '' || part === '-') throw new TypeError('Empty sort field');
    return part.startsWith('-')
      ? { field: part.slice(1), direction: 'desc' as const }
      : { field: part, direction: 'asc' as const };
  });
}

// --- helpers ----------------------------------------------------------------

function positiveInt(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`Expected a positive integer, got "${raw}"`);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
