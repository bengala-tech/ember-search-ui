import { module, test } from 'qunit';
import {
  conditionOf,
  conditionsFor,
  switchCondition,
  CONDITIONS,
} from '#src/query-builder/conditions.ts';
import { parseInput, formatInput } from '#src/query-builder/conditions.ts';

const ids = (field: Parameters<typeof conditionsFor>[0]) =>
  conditionsFor(field).map((c) => c.id);

module('Unit | query-builder | conditions', function () {
  test('conditions depend on the field type', function (assert) {
    assert.deepEqual(ids({ path: 'state', type: 'keyword' }), [
      'eq',
      'in',
      'all',
      'prefix',
      'exists',
      'missing',
    ]);
    assert.deepEqual(ids({ path: 'title', type: 'text' }), [
      'contains',
      'eq',
      'prefix',
      'exists',
      'missing',
    ]);
    assert.deepEqual(ids({ path: 'n', type: 'number' }).slice(0, 3), [
      'eq',
      'between',
      'gt',
    ]);
    assert.deepEqual(
      ids(undefined),
      ids({ path: 'x', type: 'keyword' }),
      'unknown fields act as keywords',
    );
    assert.deepEqual(ids({ path: 'n', type: 'number', operators: ['range'] }), [
      'between',
      'gt',
      'gte',
      'lt',
      'lte',
    ]);
  });

  test('dates read as before/after', function (assert) {
    const labels = conditionsFor({ path: 'at', type: 'date' }).map(
      (c) => c.label,
    );
    assert.true(labels.includes('is after'));
    assert.true(labels.includes('is on or before'));
  });

  test('conditionOf reads operator and value shape', function (assert) {
    assert.strictEqual(conditionOf({ operator: 'eq', value: 'b' }).id, 'eq');
    assert.strictEqual(
      conditionOf({ operator: 'range', value: { gt: 1 } }).id,
      'gt',
    );
    assert.strictEqual(
      conditionOf({ operator: 'range', value: { gte: 1, lte: 5 } }).id,
      'between',
    );
    assert.strictEqual(
      conditionOf({ operator: 'range', value: undefined }).id,
      'between',
    );
    assert.strictEqual(
      conditionOf({ operator: 'exists', value: false }).id,
      'missing',
    );
    assert.strictEqual(
      conditionOf({ operator: 'exists', value: true }).id,
      'exists',
    );
    assert.strictEqual(
      conditionOf({ operator: 'geo', value: 1 }).label,
      'geo',
      'custom operators pass through',
    );
  });

  test('the condition recorded in meta wins while it fits the value', function (assert) {
    const between = { condition: 'between' };
    assert.strictEqual(
      conditionOf({ operator: 'range', value: { gte: 30 }, meta: between }).id,
      'between',
    );
    assert.strictEqual(
      conditionOf({ operator: 'range', value: { gte: 30 } }).id,
      'gte',
    );
    assert.strictEqual(
      conditionOf({ operator: 'range', value: { lt: 3 }, meta: between }).id,
      'lt',
      'a value that no longer fits falls back to inference',
    );
    assert.strictEqual(
      conditionOf({ operator: 'eq', value: 3, meta: between }).id,
      'eq',
    );
  });

  test('switching conditions keeps values that still fit', function (assert) {
    assert.deepEqual(
      switchCondition({ operator: 'eq', value: 5 }, CONDITIONS['in']!),
      { operator: 'in', value: [5] },
    );
    assert.deepEqual(
      switchCondition({ operator: 'in', value: [5, 6] }, CONDITIONS['eq']!),
      { operator: 'eq', value: 5 },
    );
    assert.deepEqual(
      switchCondition(
        { operator: 'range', value: { gt: 3 } },
        CONDITIONS['lte']!,
      ),
      {
        operator: 'range',
        value: { lte: 3 },
      },
    );
    assert.deepEqual(
      switchCondition({ operator: 'eq', value: 3 }, CONDITIONS['between']!),
      {
        operator: 'range',
        value: { gte: 3 },
      },
    );
    assert.deepEqual(
      switchCondition({ operator: 'eq', value: 3 }, CONDITIONS['missing']!),
      {
        operator: 'exists',
        value: false,
      },
    );
    assert.deepEqual(
      switchCondition({ operator: 'exists', value: true }, CONDITIONS['eq']!),
      {
        operator: 'eq',
        value: undefined,
      },
    );
  });

  test('inputs parse per field type', function (assert) {
    assert.strictEqual(parseInput(' 42 ', { path: 'n', type: 'number' }), 42);
    assert.strictEqual(
      parseInput('4x', { path: 'n', type: 'number' }),
      undefined,
    );
    assert.strictEqual(
      parseInput('', { path: 'x', type: 'keyword' }),
      undefined,
    );
    assert.deepEqual(parseInput('2024-01-31', { path: 'at', type: 'date' }), {
      date: '2024-01-31',
    });
    assert.deepEqual(parseInput('now-7d/d', { path: 'at', type: 'date' }), {
      dateMath: 'now-7d/d',
    });
    assert.strictEqual(
      parseInput('true', { path: 'ok', type: 'boolean' }),
      true,
    );
    assert.strictEqual(formatInput({ dateMath: 'now/M' }), 'now/M');
    assert.strictEqual(formatInput(undefined), '');
  });
});
