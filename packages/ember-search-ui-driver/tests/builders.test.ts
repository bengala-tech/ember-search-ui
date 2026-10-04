import { describe, expect, test } from 'vitest';
import {
  and,
  anyOf,
  date,
  dateMath,
  disabled,
  eq,
  exists,
  nested,
  not,
  or,
  range,
  withId,
} from '../src/index.ts';

describe('builders', () => {
  test('nest groups freely: (x is b and u is k) or (t is k and x is c)', () => {
    expect(
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    ).toEqual({
      kind: 'group',
      op: 'or',
      children: [
        {
          kind: 'group',
          op: 'and',
          children: [
            { kind: 'condition', field: 'x', operator: 'eq', value: 'b' },
            { kind: 'condition', field: 'u', operator: 'eq', value: 'k' },
          ],
        },
        {
          kind: 'group',
          op: 'and',
          children: [
            { kind: 'condition', field: 't', operator: 'eq', value: 'k' },
            { kind: 'condition', field: 'x', operator: 'eq', value: 'c' },
          ],
        },
      ],
    });
  });

  test('not toggles negation, disabled and withId decorate any node', () => {
    const group = and(eq('a', 1));
    expect(not(group).negate).toBe(true);
    expect(not(not(group)).negate).toBe(false);
    expect(disabled(eq('a', 1)).disabled).toBe(true);
    expect(withId('facet:states', anyOf('states', ['Utah'])).id).toBe(
      'facet:states',
    );
  });

  test('value helpers', () => {
    expect(range('visitors', { gte: 1, lt: 5 }).value).toEqual({
      gte: 1,
      lt: 5,
    });
    expect(exists('due').value).toBe(true);
    expect(exists('due', false).value).toBe(false);
    expect(date('2024-01-01')).toEqual({ date: '2024-01-01' });
    expect(dateMath('now/M')).toEqual({ dateMath: 'now/M' });
  });

  test('nested wraps a single condition in an and group', () => {
    expect(nested('requirements', eq('status', 'ok'))).toEqual({
      kind: 'nested',
      path: 'requirements',
      quantifier: 'some',
      filter: {
        kind: 'group',
        op: 'and',
        children: [
          { kind: 'condition', field: 'status', operator: 'eq', value: 'ok' },
        ],
      },
    });
    expect(nested('r', or(eq('a', 1)), 'every').filter.op).toBe('or');
  });
});
