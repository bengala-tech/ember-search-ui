import { OperatorRegistry, type EvaluationContext } from './operators.ts';
import type {
  ConditionNode,
  FieldPath,
  FilterNode,
  GroupNode,
} from './types.ts';

// Semantics, shared by every codec:
//
// - A disabled node, or a condition whose value is invalid, has no effect.
// - A group with no active children has no effect (whatever its op or
//   negate): it is skipped by its parent. An empty root matches everything.
// - `negate` inverts an active node's result.
// - Field paths walk objects by key and fan out over arrays, so a condition
//   on `tags` or `author.name` tests every value found ("any value matches").
// - `nested` evaluates its filter against each item of the list at `path`:
//   some = at least one item matches, every = all items match (true for an
//   empty list), none = no item matches.

export interface EvaluateOptions {
  operators?: OperatorRegistry;
  /** Reference time for date math; defaults to Date.now(). */
  now?: number;
}

/** Does `doc` match the filter tree? */
export function matches(
  filter: GroupNode,
  doc: unknown,
  options: EvaluateOptions = {},
): boolean {
  const operators = options.operators ?? new OperatorRegistry();
  const ctx: EvaluationContext = { now: options.now ?? Date.now() };
  return evaluateNode(filter, doc, operators, ctx) ?? true;
}

/** true / false, or null when the node has no effect. */
function evaluateNode(
  node: FilterNode,
  doc: unknown,
  operators: OperatorRegistry,
  ctx: EvaluationContext,
): boolean | null {
  if (node.disabled) return null;
  let result: boolean | null;

  switch (node.kind) {
    case 'group': {
      const results = node.children
        .map((child) => evaluateNode(child, doc, operators, ctx))
        .filter((r): r is boolean => r !== null);
      if (results.length === 0) return null;
      result =
        node.op === 'and' ? results.every(Boolean) : results.some(Boolean);
      break;
    }
    case 'nested': {
      if (!isActive(node, operators)) return null;
      const per = nestedItems(doc, node.path).map(
        (item) => evaluateNode(node.filter, item, operators, ctx) ?? true,
      );
      if (node.quantifier === 'every') result = per.every(Boolean);
      else if (node.quantifier === 'none') result = !per.some(Boolean);
      else result = per.some(Boolean);
      break;
    }
    case 'condition': {
      if (!isValidCondition(node, operators)) return null;
      result = operators
        .get(node.operator)!
        .evaluate(fieldValues(doc, node.field), node.value!, ctx);
      break;
    }
  }
  return node.negate ? !result : result;
}

/** Does the node have any effect (an enabled, valid condition inside)? */
export function isActive(
  node: FilterNode,
  operators: OperatorRegistry = new OperatorRegistry(),
): boolean {
  if (node.disabled) return false;
  switch (node.kind) {
    case 'group':
      return node.children.some((child) => isActive(child, operators));
    case 'nested':
      return isActive(node.filter, operators) && node.path !== '';
    case 'condition':
      return isValidCondition(node, operators);
  }
}

export function isValidCondition(
  node: ConditionNode,
  operators: OperatorRegistry,
): boolean {
  const operator = operators.get(node.operator);
  return !!operator && node.field !== '' && operator.validate(node.value);
}

/**
 * Values at `path`, arrays flattened, null/undefined dropped. A key that
 * itself contains dots (`a.b` stored as one key) is matched before splitting.
 */
export function fieldValues(doc: unknown, path: FieldPath): unknown[] {
  const out: unknown[] = [];
  collect(doc, path.split('.'), out, true);
  return out;
}

/** The objects in the list (or single object) at `path`. */
export function nestedItems(doc: unknown, path: FieldPath): unknown[] {
  const out: unknown[] = [];
  collect(doc, path.split('.'), out, false);
  return out
    .flatMap((value): unknown[] =>
      Array.isArray(value) ? (value as unknown[]) : [value],
    )
    .filter((value) => typeof value === 'object' && value !== null);
}

function collect(
  value: unknown,
  segments: string[],
  out: unknown[],
  flattenLeaves: boolean,
): void {
  if (value === null || value === undefined) return;
  if (segments.length === 0) {
    if (flattenLeaves && Array.isArray(value)) {
      for (const item of value) collect(item, segments, out, flattenLeaves);
    } else {
      out.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, segments, out, flattenLeaves);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  // Longest key first, so `{ 'a.b': 1 }` resolves `a.b`.
  for (let i = segments.length; i > 0; i--) {
    const key = segments.slice(0, i).join('.');
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      collect(record[key], segments.slice(i), out, flattenLeaves);
      return;
    }
  }
}
