import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import {
  and,
  disabled,
  eq,
  flatten,
  hasOnlyLeafNegation,
  invalidConditions,
  materialize,
  matches,
  nested,
  not,
  or,
  prune,
  pushNegation,
  sequentialIds,
  anyOf,
  type GroupNode,
  type NodeInput,
} from '../src/index.ts';

const root = (input: NodeInput): GroupNode =>
  materialize({ ...and(input), id: 'root' }, sequentialIds()) as GroupNode;

import { doc, randomTree } from './arbitraries.ts';

const sameMatches = (left: GroupNode, right: GroupNode, docs: unknown[]) =>
  docs.every(
    (d) => matches(left, d, { now: 0 }) === matches(right, d, { now: 0 }),
  );

describe('rewrites keep the meaning of any tree', () => {
  test('prune', () => {
    fc.assert(
      fc.property(
        randomTree,
        fc.array(doc, { minLength: 1, maxLength: 8 }),
        (input, docs) => {
          const tree = root(input);
          return sameMatches(tree, prune(tree), docs);
        },
      ),
    );
  });

  test('flatten (after prune)', () => {
    fc.assert(
      fc.property(
        randomTree,
        fc.array(doc, { minLength: 1, maxLength: 8 }),
        (input, docs) => {
          const pruned = prune(root(input));
          return sameMatches(pruned, flatten(pruned), docs);
        },
      ),
    );
  });

  test('pushNegation (after prune) leaves negation only on conditions', () => {
    fc.assert(
      fc.property(
        randomTree,
        fc.array(doc, { minLength: 1, maxLength: 8 }),
        (input, docs) => {
          const pruned = prune(root(input));
          const pushed = pushNegation(pruned);
          return (
            hasOnlyLeafNegation(pushed) && sameMatches(pruned, pushed, docs)
          );
        },
      ),
    );
  });
});

describe('examples', () => {
  test('prune drops disabled nodes and groups left empty', () => {
    const tree = root(
      or(eq('x', 'b'), and(disabled(eq('u', 'k'))), disabled(eq('t', 'k'))),
    );
    expect(prune(tree)).toMatchObject({
      children: [{ kind: 'group', op: 'or', children: [{ field: 'x' }] }],
    });
  });

  test('flatten merges same-op groups and unwraps single children', () => {
    const tree = root(and(eq('a', 1), and(eq('b', 1), or(eq('c', 1)))));
    expect(
      flatten(tree).children.map((c) =>
        c.kind === 'condition' ? c.field : c.kind,
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  test('pushNegation applies De Morgan and flips nested quantifiers', () => {
    const tree = root(not(or(eq('x', 'b'), nested('items', eq('a', 1)))));
    const pushed = pushNegation(tree);
    expect(pushed.children[0]).toMatchObject({
      kind: 'group',
      op: 'and',
      children: [
        { kind: 'condition', field: 'x', negate: true },
        { kind: 'nested', quantifier: 'none' },
      ],
    });
  });

  test('invalidConditions names incomplete enabled conditions only', () => {
    const tree = materialize(
      {
        ...and(anyOf('a', []), disabled(anyOf('b', [])), eq('c', 1)),
        id: 'root',
      },
      sequentialIds('w'),
    ) as GroupNode;
    expect(invalidConditions(tree)).toEqual([
      { nodeId: 'w1', message: 'Invalid value for "in" on "a"' },
    ]);
  });
});
