import type { IdFactory } from './ids.ts';
import type {
  ConditionNode,
  FilterNode,
  GroupNode,
  NestedNode,
  NodeId,
  NodeInput,
} from './types.ts';

export const ROOT_ID: NodeId = 'root';

export class TreeError extends Error {
  override name = 'TreeError';
}

export const emptyRoot = (): GroupNode => ({
  kind: 'group',
  id: ROOT_ID,
  op: 'and',
  children: [],
});

/** Every node in the subtree, parents before children. */
export function* walk(node: FilterNode): Generator<FilterNode> {
  yield node;
  if (node.kind === 'group') {
    for (const child of node.children) yield* walk(child);
  } else if (node.kind === 'nested') {
    yield* walk(node.filter);
  }
}

export function collectIds(node: FilterNode): Set<NodeId> {
  const ids = new Set<NodeId>();
  for (const n of walk(node)) {
    if (ids.has(n.id)) throw new TreeError(`Duplicate node id "${n.id}"`);
    ids.add(n.id);
  }
  return ids;
}

export function findNode(root: FilterNode, id: NodeId): FilterNode | undefined {
  for (const n of walk(root)) if (n.id === id) return n;
  return undefined;
}

/** The group holding `id`, and its index. Nested filters are groups too. */
export function findParent(
  root: FilterNode,
  id: NodeId,
): { parent: GroupNode; index: number } | undefined {
  for (const n of walk(root)) {
    if (n.kind !== 'group') continue;
    const index = n.children.findIndex((child) => child.id === id);
    if (index !== -1) return { parent: n, index };
  }
  return undefined;
}

/**
 * Turns builder input into tree nodes: assigns missing ids, and checks that
 * none collides with `taken` (the ids already in the tree) or each other.
 */
export function materialize(
  input: NodeInput,
  idFactory: IdFactory,
  taken: Set<NodeId> = new Set(),
): FilterNode {
  const claim = (id: NodeId | undefined): NodeId => {
    let next = id ?? idFactory();
    if (id === undefined) {
      while (taken.has(next)) next = idFactory();
    } else if (taken.has(next)) {
      throw new TreeError(`Duplicate node id "${next}"`);
    }
    taken.add(next);
    return next;
  };

  switch (input.kind) {
    case 'group':
      return {
        ...input,
        id: claim(input.id),
        children: input.children.map((child) =>
          materialize(child, idFactory, taken),
        ),
      };
    case 'nested':
      return {
        ...input,
        id: claim(input.id),
        filter: materialize(input.filter, idFactory, taken) as GroupNode,
      };
    case 'condition':
      return { ...input, id: claim(input.id) };
  }
}

/**
 * Replaces the node `id` with `fn(node)`, copying only the nodes on the path
 * to it; every other subtree keeps its identity. `fn` may return `null` to
 * remove the node (not allowed for the root or a nested node's filter).
 */
export function mapNode(
  root: GroupNode,
  id: NodeId,
  fn: (node: FilterNode) => FilterNode | null,
): GroupNode {
  let found = false;

  const visit = (node: FilterNode): FilterNode | null => {
    if (node.id === id) {
      found = true;
      return fn(node);
    }
    if (node.kind === 'group') {
      let changed = false;
      const children: FilterNode[] = [];
      for (const child of node.children) {
        const next = found ? child : visit(child);
        if (next !== child) changed = true;
        if (next !== null) children.push(next);
      }
      return changed ? { ...node, children } : node;
    }
    if (node.kind === 'nested') {
      const filter = visit(node.filter);
      if (filter === null) {
        throw new TreeError(
          `Cannot remove the filter of nested node "${node.id}"; remove the nested node instead`,
        );
      }
      return filter === node.filter
        ? node
        : { ...node, filter: filter as GroupNode };
    }
    return node;
  };

  const next = visit(root);
  if (!found) throw new TreeError(`No node with id "${id}"`);
  if (next === null) throw new TreeError('Cannot remove the root group');
  if (next.kind !== 'group') throw new TreeError('The root must stay a group');
  return next;
}

export function insertNode(
  root: GroupNode,
  parentId: NodeId,
  node: FilterNode,
  index?: number,
): GroupNode {
  return mapNode(root, parentId, (parent) => {
    if (parent.kind !== 'group') {
      throw new TreeError(
        `Node "${parentId}" is a ${parent.kind}; children go into groups (a nested node's filter is a group)`,
      );
    }
    const children = [...parent.children];
    const at = index ?? children.length;
    if (at < 0 || at > children.length) {
      throw new TreeError(`Index ${at} is out of range for "${parentId}"`);
    }
    children.splice(at, 0, node);
    return { ...parent, children };
  });
}

export function removeNode(root: GroupNode, id: NodeId): GroupNode {
  return mapNode(root, id, () => null);
}

export type GroupPatch = Partial<
  Pick<GroupNode, 'op' | 'negate' | 'disabled' | 'meta'>
>;
export type ConditionPatch = Partial<
  Pick<
    ConditionNode,
    'field' | 'operator' | 'value' | 'negate' | 'disabled' | 'meta'
  >
>;
export type NestedPatch = Partial<
  Pick<NestedNode, 'path' | 'quantifier' | 'negate' | 'disabled' | 'meta'>
>;
export type NodePatch = GroupPatch | ConditionPatch | NestedPatch;

const PATCHABLE: Record<FilterNode['kind'], readonly string[]> = {
  group: ['op', 'negate', 'disabled', 'meta'],
  condition: ['field', 'operator', 'value', 'negate', 'disabled', 'meta'],
  nested: ['path', 'quantifier', 'negate', 'disabled', 'meta'],
};

/** Shallow-merges `patch`; keys set to `undefined` are removed. */
export function updateNode(
  root: GroupNode,
  id: NodeId,
  patch: NodePatch,
): GroupNode {
  return mapNode(root, id, (node) => {
    const allowed = PATCHABLE[node.kind];
    const next: Record<string, unknown> = { ...node };
    for (const [key, value] of Object.entries(patch)) {
      if (!allowed.includes(key)) {
        throw new TreeError(`Cannot set "${key}" on a ${node.kind} node`);
      }
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return next as unknown as FilterNode;
  });
}

export function moveNode(
  root: GroupNode,
  id: NodeId,
  parentId: NodeId,
  index?: number,
): GroupNode {
  if (id === ROOT_ID) throw new TreeError('Cannot move the root group');
  const node = findNode(root, id);
  if (!node) throw new TreeError(`No node with id "${id}"`);
  if (findNode(node, parentId)) {
    throw new TreeError(`Cannot move "${id}" into itself or its descendants`);
  }
  if (!findParent(root, id)) {
    throw new TreeError(
      `Node "${id}" is a nested node's filter and cannot be moved`,
    );
  }
  // `index` is the node's position after the move.
  return insertNode(removeNode(root, id), parentId, node, index);
}
