import { describe, expect, test } from 'vitest';
import {
  OperatorRegistry,
  allOf,
  and,
  anyOf,
  contains,
  date,
  dateMath,
  disabled,
  eq,
  exists,
  fieldValues,
  materialize,
  matches,
  nested,
  not,
  or,
  prefix,
  range,
  resolveDate,
  sequentialIds,
  where,
  type GroupNode,
  type NodeInput,
} from '../src/index.ts';
import { PARKS, XUT_DOCS, ids } from './fixtures.ts';

const tree = (...children: NodeInput[]): GroupNode =>
  materialize(
    { ...and(...children), id: 'root' },
    sequentialIds(),
  ) as GroupNode;

const filterDocs = <T>(
  docs: T[],
  filter: GroupNode,
  now = Date.UTC(2026, 9, 4),
) => docs.filter((doc) => matches(filter, doc, { now }));

describe('groups', () => {
  test('(x is b and u is k) or (t is k and x is c)', () => {
    const filter = tree(
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    );
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 2, 5]);
  });

  test('and binds per group, not left to right: x is b and (u is k or t is k)', () => {
    const filter = tree(eq('x', 'b'), or(eq('u', 'k'), eq('t', 'k')));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 3, 5]);
  });

  test('deep nesting with negation: (x is a or (u is k and not (t is k or x is c)))', () => {
    const filter = tree(
      or(eq('x', 'a'), and(eq('u', 'k'), not(or(eq('t', 'k'), eq('x', 'c'))))),
    );
    // 1: u k, t z, x b -> second branch. 6: x a -> first branch.
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 6]);
  });

  test('negating a group is NOT of the whole group', () => {
    const filter = tree(not(and(eq('x', 'b'), eq('u', 'k'))));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([2, 3, 4, 6]);
  });

  test('the same field twice in one and group', () => {
    const filter = tree(
      range('visitors', { gt: 3_500_000 }),
      range('visitors', { lt: 4_550_000 }),
    );
    expect(ids(filterDocs(PARKS, filter))).toEqual([1, 2, 5]);
  });

  test('an empty filter matches everything', () => {
    expect(filterDocs(XUT_DOCS, tree())).toHaveLength(XUT_DOCS.length);
  });
});

describe('disabled and inactive nodes have no effect', () => {
  test('a disabled condition is skipped', () => {
    const filter = tree(eq('x', 'b'), disabled(eq('u', 'k')));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 3, 5]);
  });

  test('a disabled branch of an or is skipped, not counted as false or true', () => {
    const filter = tree(or(eq('x', 'c'), disabled(eq('x', 'b'))));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([2, 4]);
  });

  test('a negated group whose children are all disabled has no effect', () => {
    const filter = tree(eq('u', 'k'), not(and(disabled(eq('x', 'b')))));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 4, 5, 6]);
  });

  test('empty groups are skipped inside an or', () => {
    const filter = tree(or(eq('x', 'c'), and()));
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([2, 4]);
  });

  test('incomplete conditions are skipped', () => {
    const filter = tree(
      eq('x', 'b'),
      anyOf('u', []),
      range('t', {}),
      where('t', 'unknown-op', 'k'),
      where('', 'eq', 'k'),
    );
    expect(ids(filterDocs(XUT_DOCS, filter))).toEqual([1, 3, 5]);
  });
});

describe('operators', () => {
  test('eq / in / all over multi-valued fields', () => {
    expect(ids(filterDocs(PARKS, tree(eq('states', 'California'))))).toEqual([
      1, 4,
    ]);
    expect(
      ids(filterDocs(PARKS, tree(anyOf('states', ['Utah', 'Maine'])))),
    ).toEqual([3, 5]);
    expect(
      ids(filterDocs(PARKS, tree(allOf('states', ['Wyoming', 'Idaho'])))),
    ).toEqual([2]);
    expect(
      ids(filterDocs(PARKS, tree(allOf('states', ['Wyoming', 'Utah'])))),
    ).toEqual([]);
  });

  test('range on numbers', () => {
    const filter = tree(range('visitors', { gte: 4_000_000, lte: 4_500_000 }));
    expect(ids(filterDocs(PARKS, filter))).toEqual([2, 5]);
  });

  test('range on dates', () => {
    const filter = tree(
      range('established', { gte: date('1900-01-01'), lt: date('1950-01-01') }),
    );
    expect(ids(filterDocs(PARKS, filter))).toEqual([3, 5]);
  });

  test('exists / missing, including nested optional fields', () => {
    expect(ids(filterDocs(PARKS, tree(exists('meta.featured'))))).toEqual([
      1, 5,
    ]);
    expect(
      ids(filterDocs(PARKS, tree(exists('meta.featured', false)))),
    ).toEqual([2, 3, 4]);
    expect(ids(filterDocs(PARKS, tree(eq('meta.featured', false))))).toEqual([
      5,
    ]);
  });

  test('contains is case-insensitive; prefix is not', () => {
    expect(
      ids(filterDocs(PARKS, tree(contains('description', 'DESERT')))),
    ).toEqual([4]);
    expect(ids(filterDocs(PARKS, tree(prefix('title', 'Yel'))))).toEqual([2]);
    expect(ids(filterDocs(PARKS, tree(prefix('title', 'yel'))))).toEqual([]);
  });

  test('custom operators plug into the registry', () => {
    const operators = new OperatorRegistry().register({
      id: 'longer-than',
      validate: (v) => typeof v === 'number',
      evaluate: (values, n) =>
        values.some((v) => typeof v === 'string' && v.length > (n as number)),
    });
    const filter = tree(where('title', 'longer-than', 6));
    expect(ids(PARKS.filter((p) => matches(filter, p, { operators })))).toEqual(
      [1, 2, 4],
    );
  });
});

describe('date math', () => {
  const now = Date.UTC(2026, 9, 4, 15, 30); // 2026-10-04T15:30Z
  const iso = (dm: string) =>
    new Date(resolveDate(dateMath(dm), { now })!).toISOString();

  test('rounding and offsets', () => {
    expect(iso('now')).toBe('2026-10-04T15:30:00.000Z');
    expect(iso('now/M')).toBe('2026-10-01T00:00:00.000Z');
    expect(iso('now+1M/M')).toBe('2026-11-01T00:00:00.000Z');
    expect(iso('now-7d/d')).toBe('2026-09-27T00:00:00.000Z');
    expect(iso('now/w')).toBe('2026-09-28T00:00:00.000Z'); // Monday
    expect(iso('now/y')).toBe('2026-01-01T00:00:00.000Z');
    expect(iso('2024-01-31||+1d')).toBe('2024-02-01T00:00:00.000Z');
  });

  test('invalid expressions do not resolve, so the condition is skipped', () => {
    expect(resolveDate(dateMath('now+banana'), { now })).toBeUndefined();
    const filter = tree(range('established', { gte: dateMath('now+banana') }));
    expect(filterDocs(PARKS, filter)).toHaveLength(PARKS.length);
  });

  test('"created this month" style ranges', () => {
    const docs = [
      { id: 1, at: '2026-10-02T10:00:00Z' },
      { id: 2, at: '2026-09-30T23:59:59Z' },
      { id: 3, at: '2026-11-01T00:00:00Z' },
    ];
    const filter = tree(
      range('at', { gte: dateMath('now/M'), lt: dateMath('now+1M/M') }),
    );
    expect(ids(docs.filter((d) => matches(filter, d, { now })))).toEqual([1]);
  });
});

describe('nested scopes', () => {
  test('a dotted path matches across different items; nested matches within one item', () => {
    // "a permit requirement that failed": only Yellowstone has one.
    const dotted = tree(
      eq('requirements.kind', 'permit'),
      eq('requirements.status', 'fail'),
    );
    const scoped = tree(
      nested('requirements', and(eq('kind', 'permit'), eq('status', 'fail'))),
    );
    // Yosemite matches the dotted form via two different items (permit ok + fire fail).
    expect(ids(filterDocs(PARKS, dotted))).toEqual([1, 2]);
    expect(ids(filterDocs(PARKS, scoped))).toEqual([2]);
  });

  test('every and none quantifiers; every is true for an empty list', () => {
    const allOk = tree(nested('requirements', eq('status', 'ok'), 'every'));
    expect(ids(filterDocs(PARKS, allOk))).toEqual([3, 4]);
    const noneFailed = tree(
      nested('requirements', eq('status', 'fail'), 'none'),
    );
    expect(ids(filterDocs(PARKS, noneFailed))).toEqual([3, 4]);
  });

  test('groups inside nested scopes, and nested scopes inside groups', () => {
    const filter = tree(
      or(
        nested(
          'requirements',
          or(and(eq('kind', 'fire'), eq('status', 'ok')), exists('due')),
        ),
        eq('title', 'Acadia'),
      ),
    );
    expect(ids(filterDocs(PARKS, filter))).toEqual([1, 3, 5]);
  });

  test('a negated nested scope', () => {
    const filter = tree(not(nested('requirements', eq('status', 'fail'))));
    expect(ids(filterDocs(PARKS, filter))).toEqual([3, 4]);
  });

  test('a nested scope with no active conditions has no effect', () => {
    const filter = tree(nested('requirements', disabled(eq('status', 'fail'))));
    expect(filterDocs(PARKS, filter)).toHaveLength(PARKS.length);
  });
});

describe('fieldValues', () => {
  test('walks objects, fans out over arrays, prefers keys containing dots', () => {
    const doc = {
      a: [{ b: 1 }, { b: [2, 3] }, { b: null }],
      'custom.4-date': 'x',
      document: { '4-date': 'y' },
    };
    expect(fieldValues(doc, 'a.b')).toEqual([1, 2, 3]);
    expect(fieldValues(doc, 'custom.4-date')).toEqual(['x']);
    expect(fieldValues({ custom: { '4-date': 'y' } }, 'custom.4-date')).toEqual(
      ['y'],
    );
    expect(fieldValues(doc, 'missing.path')).toEqual([]);
  });
});
