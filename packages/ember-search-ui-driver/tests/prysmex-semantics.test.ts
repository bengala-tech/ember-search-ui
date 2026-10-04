import fc from 'fast-check';
import { expect, test } from 'vitest';
import {
  OperatorRegistry,
  and,
  materialize,
  matches,
  prysmexGroupFilters,
  prysmexListFilters,
  sequentialIds,
  type CodecContext,
  type GroupNode,
  type NodeInput,
} from '../src/index.ts';
import { doc, randomTree } from './arbitraries.ts';

// For any tree a format can express: serialize it, send it "over the wire"
// (JSON), decode it like a server would, and it must match exactly the same
// documents as the internal tree.

const ctx: CodecContext = {
  operators: new OperatorRegistry(),
  idFactory: sequentialIds('s'),
};
const root = (input: NodeInput) =>
  materialize({ ...and(input), id: 'root' }, sequentialIds()) as GroupNode;
const overTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const formats = {
  list: prysmexListFilters(),
  groups: prysmexGroupFilters(),
};

for (const [name, codec] of Object.entries(formats)) {
  test(`${name}: what goes over the wire means the same as the internal tree`, () => {
    let expressible = 0;
    fc.assert(
      fc.property(
        randomTree,
        fc.array(doc, { minLength: 1, maxLength: 8 }),
        (input, docs) => {
          const tree = root(input);
          if (!codec.supports(tree, ctx).ok) return;
          expressible++;
          const wire = overTheWire(codec.serialize(tree, ctx) as never);
          const decoded = codec.parse!(wire, ctx);
          for (const d of docs) {
            expect(matches(decoded, d, { now: 0 })).toBe(
              matches(tree, d, { now: 0 }),
            );
          }
        },
      ),
      { numRuns: 400 },
    );
    // the property must have been exercised, not skipped
    expect(expressible).toBeGreaterThan(name === 'list' ? 40 : 150);
  });
}
