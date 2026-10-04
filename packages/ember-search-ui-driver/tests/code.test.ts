import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import * as builders from '../src/builders.ts';
import {
  and,
  anyOf,
  contains,
  date,
  dateMath,
  disabled,
  eq,
  exists,
  filterToCode,
  materialize,
  nested,
  not,
  or,
  range,
  raw,
  sequentialIds,
  where,
  withId,
  type NodeInput,
} from '../src/index.ts';
import { randomTree } from './arbitraries.ts';

/** Runs printed code with the builders in scope. */
function run(code: string): NodeInput {
  const names = Object.keys(builders);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call -- the point is to run the printed code
  return new Function(...names, `return ${code};`)(
    ...names.map((n) => builders[n as keyof typeof builders]),
  ) as NodeInput;
}

const TREES: Record<string, NodeInput> = {
  plain: and(anyOf('state', ['created', 'pending']), eq('priority', 'high')),
  negated: and(not(eq('project', "O'Hare")), exists('cost', false)),
  dates: or(
    range('cost', { gte: 3000 }),
    and(
      range('due_at', { lt: dateMath('now') }),
      range('created_at', { gte: date('2026-06-01') }),
    ),
  ),
  nested: and(
    nested('checks', and(eq('result', 'fail'), eq('severity', 'major'))),
    nested('checks', eq('result', 'pass'), 'every'),
    not(nested('checks', eq('result', 'fail'), 'none')),
  ),
  wrappers: and(
    disabled(or(contains('title', 'a\\b\nc'), eq('x', null))),
    withId('filter:state', anyOf('state', ['done'])),
  ),
  odd: and(
    where('x', 'eq', [1, 2]),
    where('geo', 'near', { lat: 1, 'max-km': 5 }),
    raw('legacy', { a: [1, { b: true }] }),
    where('y', 'exists'),
  ),
  empty: and(),
};

describe('filterToCode', () => {
  test.each(Object.entries(TREES))(
    '%s: the code builds the same tree',
    (_, tree) => {
      expect(run(filterToCode(tree))).toEqual(tree);
    },
  );

  test('any random tree: the code builds the same tree', () => {
    fc.assert(
      fc.property(randomTree, (tree) => {
        expect(run(filterToCode(tree))).toEqual(tree);
      }),
    );
  });

  test('ids: generated ones are left out, meaningful ones kept', () => {
    const tree = materialize(TREES['wrappers']!, sequentialIds('n'));
    const code = filterToCode(tree);
    expect(code).not.toContain("'n");
    expect(code).toContain("withId('filter:state', anyOf('state', ['done']))");
    expect(filterToCode(tree, { keepId: () => false })).not.toContain('withId');
  });

  test('short trees stay on one line, long ones break per argument', () => {
    expect(filterToCode(TREES['plain']!, { width: 200 })).toBe(
      "and(anyOf('state', ['created', 'pending']), eq('priority', 'high'))",
    );
    expect(filterToCode(TREES['dates']!)).toBe(
      [
        'or(',
        "  range('cost', { gte: 3000 }),",
        '  and(',
        "    range('due_at', { lt: dateMath('now') }),",
        "    range('created_at', { gte: date('2026-06-01') }),",
        '  ),',
        ')',
      ].join('\n'),
    );
  });

  test('imports: one line with the builders used', () => {
    expect(filterToCode(TREES['dates']!, { imports: true })).toMatch(
      /^import \{ and, date, dateMath, or, range \} from 'ember-search-ui-driver';\n\nor\(/,
    );
    expect(filterToCode(eq('a', 1), { imports: true, from: './filters' })).toBe(
      "import { eq } from './filters';\n\neq('a', 1)",
    );
  });

  test('meta is UI-only and left out', () => {
    expect(filterToCode({ ...eq('a', 1), meta: { label: 'A' } })).toBe(
      "eq('a', 1)",
    );
  });
});
