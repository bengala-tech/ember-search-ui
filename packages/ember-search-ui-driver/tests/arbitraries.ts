import fc from 'fast-check';
import {
  and,
  anyOf,
  disabled,
  eq,
  nested,
  not,
  or,
  range,
  type NodeInput,
} from '../src/index.ts';

// --- random trees and documents ---------------------------------------------

const FIELDS = ['a', 'b', 'c'] as const;
const value = fc.integer({ min: 0, max: 2 });

const condition: fc.Arbitrary<NodeInput> = fc.oneof(
  fc.tuple(fc.constantFrom(...FIELDS), value).map(([f, v]) => eq(f, v)),
  fc
    .tuple(fc.constantFrom(...FIELDS), fc.array(value, { maxLength: 2 }))
    .map(([f, vs]) => anyOf(f, vs)),
  fc
    .tuple(fc.constantFrom(...FIELDS), value)
    .map(([f, v]) => range(f, { gte: v })),
);

const decorate = (node: fc.Arbitrary<NodeInput>) =>
  fc
    .tuple(node, fc.boolean(), fc.integer({ min: 0, max: 5 }))
    .map(([n, negated, off]) => {
      const withNegation = negated ? not(n) : n;
      return off === 0 ? disabled(withNegation) : withNegation; // ~1 in 6 disabled
    });

export const { tree: randomTree } = fc.letrec<{
  tree: NodeInput;
  inner: NodeInput;
}>((tie) => ({
  tree: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    decorate(condition),
    decorate(
      fc
        .tuple(
          fc.constantFrom('and', 'or'),
          fc.array(tie('tree'), { maxLength: 4 }),
        )
        .map(([op, children]) =>
          op === 'and' ? and(...children) : or(...children),
        ),
    ),
    decorate(
      fc
        .tuple(tie('inner'), fc.constantFrom('some', 'every', 'none'))
        .map(([inner, q]) => nested('items', inner, q)),
    ),
  ),
  inner: decorate(condition),
}));

const item = fc.record({ a: value, b: value, c: value });
export const doc = fc.record({
  a: value,
  b: value,
  c: value,
  items: fc.array(item, { maxLength: 3 }),
});
