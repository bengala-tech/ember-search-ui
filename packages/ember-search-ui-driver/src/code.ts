import { isDateValue } from './operators.ts';
import type { FilterValue, NodeInput, Scalar } from './types.ts';

// Prints a filter tree as the builder calls that make it:
//
//   or(range('cost', { gte: 3000 }), and(eq('state', 'pending'), ...))
//
// so a tree built in a UI can be pasted into code. Node meta is UI-only and
// left out; ids are kept only when they are meaningful (see `keepId`).

export interface FilterToCodeOptions {
  /** Start with the import line for the builders used. Default false. */
  imports?: boolean;
  /** The module the import line names. Default 'ember-search-ui-driver'. */
  from?: string;
  /** Break calls longer than this onto several lines. Default 80. */
  width?: number;
  /**
   * Which node ids to keep, as `withId(id, ...)`. Default: ids with a ":"
   * (`filter:state`, `facet:states`), which UIs look nodes up by; generated
   * ids are left out.
   */
  keepId?: (id: string) => boolean;
}

/** A call (breakable over lines) or a piece of code printed as is. */
type Doc = string | { call: string; args: Doc[] };

const defaultKeepId = (id: string) => id.includes(':');

export function filterToCode(
  node: NodeInput,
  options: FilterToCodeOptions = {},
): string {
  const keepId = options.keepId ?? defaultKeepId;
  const width = options.width ?? 80;
  const used = new Set<string>();

  const call = (name: string, ...args: Doc[]): Doc => {
    used.add(name);
    return { call: name, args };
  };

  const value = (v: unknown): string => {
    if (typeof v === 'string') return quote(v);
    if (v === null || typeof v !== 'object') return String(v);
    if (Array.isArray(v)) return `[${v.map(value).join(', ')}]`;
    if (isDateValue(v)) {
      used.add('date' in v ? 'date' : 'dateMath');
      return 'date' in v
        ? `date(${quote(v.date)})`
        : `dateMath(${quote(v.dateMath)})`;
    }
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, x]) => `${key(k)}: ${value(x)}`).join(', ')} }`;
  };

  const condition = (
    field: string,
    operator: string,
    v: FilterValue | undefined,
  ): Doc => {
    const f = quote(field);
    if (v === undefined) return call('where', f, quote(operator));
    const scalars = Array.isArray(v) && v.every(isScalar);
    switch (operator) {
      case 'eq':
        if (isScalar(v) || isDateValue(v)) return call('eq', f, value(v));
        break;
      case 'in':
        if (scalars) return call('anyOf', f, value(v));
        break;
      case 'all':
        if (scalars) return call('allOf', f, value(v));
        break;
      case 'range':
        if (isPlainObject(v)) return call('range', f, value(v));
        break;
      case 'exists':
        if (v === true) return call('exists', f);
        if (v === false) return call('exists', f, 'false');
        break;
      case 'contains':
      case 'prefix':
        if (typeof v === 'string') return call(operator, f, value(v));
        break;
      case 'raw':
        return call('raw', f, value(v));
    }
    return call('where', f, quote(operator), value(v));
  };

  const print = (n: NodeInput): Doc => {
    let doc: Doc;
    switch (n.kind) {
      case 'condition':
        doc = condition(n.field, n.operator, n.value);
        break;
      case 'group':
        doc = call(n.op, ...n.children.map(print));
        break;
      case 'nested': {
        const inner = n.filter;
        // nested() wraps a lone node in and(): print just the node
        const lone =
          inner.op === 'and' &&
          inner.children.length === 1 &&
          !inner.negate &&
          !inner.disabled &&
          !(inner.id && keepId(inner.id));
        const args = [quote(n.path), print(lone ? inner.children[0]! : inner)];
        if (n.quantifier !== 'some') args.push(quote(n.quantifier));
        doc = call('nested', ...args);
        break;
      }
    }
    if (n.negate) doc = call('not', doc);
    if (n.disabled) doc = call('disabled', doc);
    if (n.id && keepId(n.id)) doc = call('withId', quote(n.id), doc);
    return doc;
  };

  const code = render(print(node), 0, width);
  if (!options.imports) return code;
  const from = options.from ?? 'ember-search-ui-driver';
  const names = [...used].sort();
  return `import { ${names.join(', ')} } from '${from}';\n\n${code}`;
}

/** Prints the doc flat if it fits, else one argument per line. */
function render(doc: Doc, indent: number, width: number): string {
  if (typeof doc === 'string') return doc;
  const flat = flatten(doc);
  if (indent + flat.length <= width || doc.args.length === 0) return flat;
  const pad = ' '.repeat(indent + 2);
  const args = doc.args.map(
    (arg) => `${pad}${render(arg, indent + 2, width)},`,
  );
  return `${doc.call}(\n${args.join('\n')}\n${' '.repeat(indent)})`;
}

function flatten(doc: Doc): string {
  if (typeof doc === 'string') return doc;
  return `${doc.call}(${doc.args.map(flatten).join(', ')})`;
}

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function key(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : quote(name);
}

function isScalar(v: unknown): v is Scalar {
  return v === null || ['string', 'number', 'boolean'].includes(typeof v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
