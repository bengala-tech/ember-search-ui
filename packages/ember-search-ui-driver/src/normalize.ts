import { isActive, isValidCondition } from './evaluate.ts';
import { OperatorRegistry } from './operators.ts';
import { walk } from './tree.ts';
import type {
  FilterNode,
  GroupNode,
  NestedNode,
  ValidationWarning,
} from './types.ts';

// Rewrites used by codecs before encoding. Each returns a tree with the same
// meaning under the semantics in evaluate.ts; ids of rewritten nodes may be
// dropped or reused, so never feed the result back into UI state.

/**
 * Removes everything with no effect: disabled nodes, invalid conditions and
 * groups (or nested nodes) left without active children. The root stays,
 * possibly empty (= match everything).
 */
export function prune(
  root: GroupNode,
  operators: OperatorRegistry = new OperatorRegistry(),
): GroupNode {
  const visit = (node: FilterNode): FilterNode | null => {
    if (!isActive(node, operators)) return null;
    switch (node.kind) {
      case 'condition':
        return node;
      case 'nested':
        return { ...node, filter: visit(node.filter) as GroupNode };
      case 'group': {
        const children = node.children
          .map(visit)
          .filter((c): c is FilterNode => c !== null);
        return { ...node, children };
      }
    }
  };
  return (visit(root) as GroupNode | null) ?? { ...root, children: [] };
}

/** Enabled conditions that will be skipped because they are incomplete. */
export function invalidConditions(
  root: GroupNode,
  operators: OperatorRegistry = new OperatorRegistry(),
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const visit = (node: FilterNode) => {
    if (node.disabled) return;
    if (node.kind === 'group') node.children.forEach(visit);
    else if (node.kind === 'nested') visit(node.filter);
    else if (!isValidCondition(node, operators)) {
      warnings.push({
        nodeId: node.id,
        message: !operators.has(node.operator)
          ? `Unknown operator "${node.operator}"`
          : node.field === ''
            ? 'Missing field'
            : `Invalid value for "${node.operator}" on "${node.field}"`,
      });
    }
  };
  visit(root);
  return warnings;
}

/**
 * Merges a child group into its parent when both use the same op and the
 * child is not negated, and replaces single-child groups by their child.
 * Expects a pruned tree. The root stays a group.
 */
export function flatten(root: GroupNode): GroupNode {
  const visit = (node: FilterNode): FilterNode => {
    if (node.kind === 'condition') return node;
    if (node.kind === 'nested') {
      return { ...node, filter: flattenGroup(node.filter) };
    }
    const group = flattenGroup(node);
    if (group.children.length === 1 && !group.negate) return group.children[0]!;
    return group;
  };

  const flattenGroup = (group: GroupNode): GroupNode => {
    const children: FilterNode[] = [];
    for (const child of group.children.map(visit)) {
      if (child.kind === 'group' && child.op === group.op && !child.negate) {
        children.push(...child.children);
      } else {
        children.push(child);
      }
    }
    return { ...group, children };
  };

  return flattenGroup(root);
}

/**
 * Moves every negation down to conditions (De Morgan), for formats that can
 * only negate leaves. Nested quantifiers absorb negation:
 * NOT some = none, NOT none = some, NOT every(f) = some(NOT f).
 */
export function pushNegation(root: GroupNode): GroupNode {
  const visit = (node: FilterNode, negated: boolean): FilterNode => {
    const flip = negated !== !!node.negate;
    const { negate, ...rest } = node;
    void negate;
    switch (node.kind) {
      case 'condition':
        return flip ? { ...rest, negate: true } : rest;
      case 'group':
        return {
          ...(rest as GroupNode),
          op: flip ? (node.op === 'and' ? 'or' : 'and') : node.op,
          children: node.children.map((child) => visit(child, flip)),
        };
      case 'nested': {
        const nestedNode = rest as NestedNode;
        if (!flip) {
          return {
            ...nestedNode,
            filter: visit(node.filter, false) as GroupNode,
          };
        }
        if (node.quantifier === 'every') {
          return {
            ...nestedNode,
            quantifier: 'some',
            filter: wrap(visit(node.filter, true)),
          };
        }
        return {
          ...nestedNode,
          quantifier: node.quantifier === 'some' ? 'none' : 'some',
          filter: visit(node.filter, false) as GroupNode,
        };
      }
    }
  };
  return wrap(visit(root, false));

  function wrap(node: FilterNode): GroupNode {
    return node.kind === 'group'
      ? node
      : { kind: 'group', id: `${node.id}:group`, op: 'and', children: [node] };
  }
}

/** True when no node in the tree is negated except conditions. */
export function hasOnlyLeafNegation(root: GroupNode): boolean {
  for (const node of walk(root)) {
    if (node.negate && node.kind !== 'condition') return false;
  }
  return true;
}
