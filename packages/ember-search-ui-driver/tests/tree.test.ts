import { describe, expect, test } from 'vitest';
import {
  TreeError,
  and,
  collectIds,
  emptyRoot,
  eq,
  findNode,
  findParent,
  insertNode,
  materialize,
  moveNode,
  nested,
  or,
  removeNode,
  sequentialIds,
  updateNode,
  withId,
  type GroupNode,
} from '../src/index.ts';

const build = () =>
  materialize(
    {
      ...and(
        withId(
          'left',
          or(withId('xb', eq('x', 'b')), withId('uk', eq('u', 'k'))),
        ),
        withId('right', and(withId('tk', eq('t', 'k')))),
        withId(
          'reqs',
          nested('requirements', withId('ok', eq('status', 'ok'))),
        ),
      ),
      id: 'root',
    },
    sequentialIds(),
  ) as GroupNode;

describe('materialize', () => {
  test('assigns ids to nodes without one, keeps explicit ids', () => {
    const root = materialize(
      or(eq('a', 1), withId('mine', eq('b', 2))),
      sequentialIds('t'),
    );
    expect([...collectIds(root)].sort()).toEqual(['mine', 't1', 't2']);
  });

  test('rejects duplicate explicit ids and ids already in the tree', () => {
    expect(() =>
      materialize(
        and(withId('a', eq('x', 1)), withId('a', eq('y', 1))),
        sequentialIds(),
      ),
    ).toThrow(TreeError);
    expect(() =>
      materialize(
        withId('root', eq('x', 1)),
        sequentialIds(),
        new Set(['root']),
      ),
    ).toThrow(/Duplicate node id "root"/);
  });

  test('generated ids skip ids that are taken', () => {
    const node = materialize(
      eq('x', 1),
      sequentialIds(),
      new Set(['n1', 'n2']),
    );
    expect(node.id).toBe('n3');
  });
});

describe('edits are immutable and share untouched subtrees', () => {
  test('insert into a nested group, keep siblings by identity', () => {
    const root = build();
    const node = materialize(eq('x', 'c'), sequentialIds('new'));
    const next = insertNode(root, 'left', node, 1);
    expect(findParent(next, node.id)).toMatchObject({
      parent: { id: 'left' },
      index: 1,
    });
    expect(root.children[0]).not.toBe(next.children[0]); // path copied
    expect(next.children[1]).toBe(root.children[1]); // sibling shared
    expect(next.children[2]).toBe(root.children[2]);
    expect(findNode(root, node.id)).toBeUndefined(); // original untouched
  });

  test('insert into a nested scope goes through its filter group', () => {
    const root = build();
    const reqs = findNode(root, 'reqs');
    if (reqs?.kind !== 'nested') throw new Error('expected nested');
    const next = insertNode(
      root,
      reqs.filter.id,
      materialize(eq('kind', 'fire'), sequentialIds('k')),
    );
    expect(findParent(next, 'k1')?.parent.id).toBe(reqs.filter.id);
    expect(() =>
      insertNode(root, 'reqs', materialize(eq('a', 1), sequentialIds('z'))),
    ).toThrow(/children go into groups/);
  });

  test('update patches allowed keys and removes keys set to undefined', () => {
    const negated = updateNode(build(), 'xb', { negate: true, value: 'c' });
    expect(findNode(negated, 'xb')).toMatchObject({ value: 'c', negate: true });
    const cleared = updateNode(negated, 'xb', { negate: undefined });
    expect(findNode(cleared, 'xb')).not.toHaveProperty('negate');
    expect(() => updateNode(build(), 'left', { field: 'x' })).toThrow(
      /Cannot set "field" on a group/,
    );
  });

  test('remove deletes the subtree; root and nested filters cannot be removed', () => {
    const next = removeNode(build(), 'left');
    expect(findNode(next, 'xb')).toBeUndefined();
    expect(() => removeNode(build(), 'root')).toThrow(/root/);
    const reqs = findNode(build(), 'reqs');
    if (reqs?.kind !== 'nested') throw new Error('expected nested');
    expect(() => removeNode(build(), reqs.filter.id)).toThrow(
      /remove the nested node instead/,
    );
  });

  test('move between groups and within a group; index is the final position', () => {
    const across = moveNode(build(), 'tk', 'left', 0);
    expect(findParent(across, 'tk')).toMatchObject({
      parent: { id: 'left' },
      index: 0,
    });
    const within = moveNode(build(), 'xb', 'left', 1);
    const left = findNode(within, 'left');
    expect(left?.kind === 'group' && left.children.map((c) => c.id)).toEqual([
      'uk',
      'xb',
    ]);
  });

  test('cannot move a node into itself or its descendants', () => {
    expect(() => moveNode(build(), 'left', 'left')).toThrow(/into itself/);
    expect(() => moveNode(build(), 'root', 'left')).toThrow(/root/);
  });

  test('unknown ids are reported', () => {
    expect(() => updateNode(emptyRoot(), 'nope', {})).toThrow(
      /No node with id "nope"/,
    );
  });
});
