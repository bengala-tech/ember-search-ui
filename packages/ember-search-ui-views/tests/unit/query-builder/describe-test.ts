import { module, test } from 'qunit';
import {
  and,
  dateMath,
  disabled,
  eq,
  exists,
  materialize,
  named,
  nested,
  not,
  or,
  range,
  sequentialIds,
  anyOf,
  type GroupNode,
  type NodeInput,
} from 'ember-search-ui-driver';
import { describeFilter, describePill } from '#src/query-builder/describe.ts';

const root = (...children: NodeInput[]) =>
  materialize(
    { ...and(...children), id: 'root' },
    sequentialIds(),
  ) as GroupNode;

module('Unit | query-builder | describeFilter', function () {
  test('nested groups read with parentheses', function (assert) {
    assert.strictEqual(
      describeFilter(
        root(
          or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
        ),
      ),
      '(x is b AND u is k) OR (t is k AND x is c)',
    );
  });

  test('negation, disabled nodes and empty trees', function (assert) {
    assert.strictEqual(describeFilter(root()), 'everything');
    assert.strictEqual(
      describeFilter(
        root(eq('x', 'b'), not(or(eq('t', 'k'), disabled(eq('x', 'c'))))),
      ),
      'x is b AND NOT t is k',
    );
    assert.strictEqual(
      describeFilter(root(eq('x', 'b'), not(or(eq('t', 'k'), eq('x', 'c'))))),
      'x is b AND NOT (t is k OR x is c)',
    );
  });

  test('labels, options, ranges, dates and nested lists', function (assert) {
    const fields = {
      state: {
        path: 'state',
        type: 'keyword',
        label: 'State',
        options: [{ value: 'open', label: 'Open' }],
      },
      score: { path: 'score', type: 'number', label: 'Score' },
      due: { path: 'due', type: 'date', label: 'Due' },
      requirements: {
        path: 'requirements',
        type: 'object',
        nested: true,
        label: 'Requirement',
        fields: {
          status: { path: 'status', type: 'keyword', label: 'Status' },
        },
      },
    };
    assert.strictEqual(
      describeFilter(
        root(
          anyOf('state', ['open']),
          range('score', { gte: 1, lte: 5 }),
          range('due', { lt: dateMath('now/M') }),
          not(exists('due')),
          nested('requirements', eq('status', 'fail'), 'none'),
        ),
        fields,
      ),
      'State is any of [Open] AND Score is between 1 and 5 AND Due is before now/M AND NOT Due has a value AND no Requirement item where (Status is fail)',
    );
  });
});

module('Unit | query-builder | labels and pills', function () {
  const fields = {
    project: {
      path: 'project',
      type: 'keyword',
      label: 'Project',
      options: [
        { value: 'a', label: 'Plant A' },
        { value: 'b', label: 'Plant B' },
      ],
    },
    cost: { path: 'cost', type: 'number', label: 'Cost' },
    checks: {
      path: 'checks',
      type: 'object',
      nested: true,
      label: 'Check',
      fields: { result: { path: 'result', type: 'keyword', label: 'Result' } },
    },
  };

  test('describeFilter reads a labelled node as its label', function (assert) {
    assert.strictEqual(
      describeFilter(
        root(
          named('Late work', or(eq('x', 1), eq('x', 2))),
          not(named('Plant A', eq('project', 'a'))),
          { ...eq('cost', 3), meta: { label: 'Cheap' } },
          disabled(named('Off', eq('x', 3))),
        ),
        fields,
      ),
      'Late work AND NOT Plant A AND Cheap',
    );
  });

  test('describePill: label, else a short description', function (assert) {
    const [plant, both, many, any, cost, scoped, empty, labelled] = root(
      eq('project', 'a'),
      anyOf('project', ['a', 'b']),
      and(eq('x', 1), eq('y', 2)),
      or(eq('x', 1), eq('y', 2)),
      range('cost', { gte: 3000 }),
      nested('checks', eq('result', 'fail')),
      or(),
      named('Plant A', eq('project', 'a')),
    ).children;
    const pill = (node: unknown) =>
      describePill(node as Parameters<typeof describePill>[0], fields);
    assert.strictEqual(pill(plant), 'Project: Plant A');
    assert.strictEqual(pill(both), 'Project: Plant A, Plant B');
    assert.strictEqual(pill(many), '2 conditions');
    assert.strictEqual(pill(any), 'any of 2 conditions');
    assert.strictEqual(pill(cost), 'Cost: is at least 3000');
    assert.strictEqual(pill(scoped), 'some Check item where (Result is fail)');
    assert.strictEqual(pill(empty), 'no conditions');
    assert.strictEqual(pill(labelled), 'Plant A');
  });

  test('describePill: NOT, disabled nodes and meta.label', function (assert) {
    const [negated, off, fromMeta, one] = root(
      not(named('Plant A', eq('project', 'a'))),
      disabled(not(eq('project', 'b'))),
      { ...eq('project', 'a'), meta: { label: 'Mine' } },
      and(eq('x', 1)),
    ).children;
    assert.strictEqual(describePill(negated!, fields), 'NOT Plant A');
    assert.strictEqual(describePill(off!, fields), 'NOT Project: Plant B');
    assert.strictEqual(describePill(fromMeta!, fields), 'Mine');
    assert.strictEqual(describePill(one!, fields), '1 condition');
  });
});
