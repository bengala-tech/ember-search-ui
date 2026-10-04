import { module, test } from 'qunit';
import {
  and,
  dateMath,
  disabled,
  eq,
  exists,
  materialize,
  nested,
  not,
  or,
  range,
  sequentialIds,
  anyOf,
  type GroupNode,
  type NodeInput,
} from 'ember-search-ui-driver';
import { describeFilter } from '#src/query-builder/describe.ts';

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
