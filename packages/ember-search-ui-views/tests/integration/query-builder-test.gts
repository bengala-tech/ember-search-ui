import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, select, settled } from '@ember/test-helpers';
import {
  SearchDriver,
  memoryBackend,
  sequentialIds,
  type FieldSchema,
} from 'ember-search-ui-driver';
import { Search } from 'ember-search-ui';
import QueryBuilder from '#src/components/query-builder.gts';
import { describeFilter } from '#src/query-builder/describe.ts';

interface Doc {
  id: number;
  x: string;
  u: string;
  t: string;
  score: number;
  tags: string[];
  requirements: { kind: string; status: string }[];
}

const DOCS: Doc[] = [
  {
    id: 1,
    x: 'b',
    u: 'k',
    t: 'z',
    score: 10,
    tags: ['a'],
    requirements: [{ kind: 'permit', status: 'ok' }],
  },
  {
    id: 2,
    x: 'c',
    u: 'z',
    t: 'k',
    score: 20,
    tags: ['a', 'b'],
    requirements: [{ kind: 'permit', status: 'fail' }],
  },
  { id: 3, x: 'b', u: 'z', t: 'k', score: 30, tags: [], requirements: [] },
  {
    id: 4,
    x: 'c',
    u: 'k',
    t: 'z',
    score: 40,
    tags: ['b'],
    requirements: [{ kind: 'fire', status: 'fail' }],
  },
  {
    id: 5,
    x: 'b',
    u: 'k',
    t: 'k',
    score: 50,
    tags: ['c'],
    requirements: [
      { kind: 'permit', status: 'fail' },
      { kind: 'fire', status: 'ok' },
    ],
  },
  { id: 6, x: 'a', u: 'k', t: 'k', score: 60, tags: [], requirements: [] },
];

const FIELDS: FieldSchema = {
  x: { path: 'x', type: 'keyword', label: 'X' },
  u: { path: 'u', type: 'keyword', label: 'U' },
  t: {
    path: 't',
    type: 'keyword',
    label: 'T',
    options: [
      { value: 'k', label: 'K' },
      { value: 'z', label: 'Z' },
    ],
  },
  score: { path: 'score', type: 'number', label: 'Score' },
  tags: {
    path: 'tags',
    type: 'keyword',
    label: 'Tags',
    options: [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ],
  },
  requirements: {
    path: 'requirements',
    type: 'object',
    nested: true,
    label: 'Requirement',
    fields: {
      kind: { path: 'kind', type: 'keyword', label: 'Kind' },
      status: { path: 'status', type: 'keyword', label: 'Status' },
    },
  },
};

const idsOf = (results: readonly Doc[]) => results.map((r) => r.id).join(',');
const describe = (search: { filter: Parameters<typeof describeFilter>[0] }) =>
  describeFilter(search.filter, FIELDS);

// Selectors into the rendered tree
const ROOT = '.sui-query-builder > .sui-qb-group';
const child = (parent: string, n: number) =>
  `${parent} > .sui-qb-children > li:nth-child(${n})`;
const group = (parent: string, n: number) =>
  `${child(parent, n)} > .sui-qb-group`;
const row = (parent: string, n: number) =>
  `${child(parent, n)} > .sui-qb-condition`;
const footer = (parent: string, label: string) =>
  `${parent} > .sui-qb-footer button[data-test-add="${label}"]`;

async function setRow(
  selector: string,
  field: string,
  condition: string,
  value?: string,
) {
  await select(`${selector} .sui-qb-field`, field);
  await select(`${selector} .sui-qb-operator`, condition);
  if (value !== undefined)
    await fillIn(`${selector} .sui-qb-value input`, value);
}

module('Integration | Component | QueryBuilder', function (hooks) {
  setupRenderingTest(hooks);

  let driver: SearchDriver<Doc>;
  hooks.beforeEach(function () {
    driver = new SearchDriver<Doc>({
      backend: memoryBackend(DOCS),
      idFactory: sequentialIds(),
    });
  });
  hooks.afterEach(function () {
    driver.destroy();
  });

  const renderBuilder = () => {
    const d = driver;
    return render(
      <template>
        <Search @driver={{d}} as |search|>
          <QueryBuilder @search={{search}} @fields={{FIELDS}} />
          <p data-test-summary>{{describe search}}</p>
          <p data-test-ids>{{idsOf search.results}}</p>
        </Search>
      </template>,
    );
  };

  test('an empty filter matches everything', async function (assert) {
    await renderBuilder();
    assert.dom(`${ROOT} .sui-qb-empty`).exists();
    assert
      .dom(`${ROOT} .sui-qb-segmented button[aria-pressed="true"]`)
      .hasText('all');
    assert.dom('[data-test-ids]').hasText('1,2,3,4,5,6');
  });

  test('build (x is b and u is k) or (t is k and x is c) with the UI', async function (assert) {
    await renderBuilder();

    // Match ANY of: ...
    await click(
      `${ROOT} > .sui-qb-header .sui-qb-segmented button:nth-child(2)`,
    );

    // first group: x is b AND u is k
    await click(footer(ROOT, 'group'));
    const first = group(ROOT, 1);
    assert
      .dom(
        `${first} > .sui-qb-header .sui-qb-segmented button[aria-pressed="true"]`,
      )
      .hasText('all');
    await setRow(row(first, 1), 'x', 'eq', 'b');
    await click(footer(first, 'condition'));
    await setRow(row(first, 2), 'u', 'eq', 'k');

    // second group: t is k AND x is c (t has options: a select)
    await click(footer(ROOT, 'group'));
    const second = group(ROOT, 2);
    await select(`${row(second, 1)} .sui-qb-field`, 't');
    await select(`${row(second, 1)} .sui-qb-value select`, 'k');
    await click(footer(second, 'condition'));
    await setRow(row(second, 2), 'x', 'eq', 'c');

    assert
      .dom('[data-test-summary]')
      .hasText('(X is b AND U is k) OR (T is K AND X is c)');
    assert.dom('[data-test-ids]').hasText('1,2,5');
  });

  test('NOT, on/off and remove work on groups and rows', async function (assert) {
    await renderBuilder();
    await click(footer(ROOT, 'group'));
    const inner = group(ROOT, 1);
    await setRow(row(inner, 1), 'x', 'eq', 'b');
    await click(footer(inner, 'condition'));
    await setRow(row(inner, 2), 'u', 'eq', 'k');
    // root is AND, so "+ Group" adds an OR group
    assert.dom('[data-test-summary]').hasText('X is b OR U is k');
    assert.dom('[data-test-ids]').hasText('1,3,4,5,6');

    await click(`${inner} > .sui-qb-header .sui-qb-not`);
    assert
      .dom(`${inner} > .sui-qb-header .sui-qb-not`)
      .hasAttribute('aria-pressed', 'true');
    assert.dom('[data-test-summary]').hasText('NOT (X is b OR U is k)');
    assert.dom('[data-test-ids]').hasText('2');

    await click(`${row(inner, 2)} .sui-qb-not`);
    assert.dom('[data-test-summary]').hasText('NOT (X is b OR NOT U is k)');
    assert.dom('[data-test-ids]').hasText('4,6');

    await click(`${row(inner, 1)} .sui-qb-enabled`);
    assert.dom(row(inner, 1)).hasClass('is-disabled');
    assert.dom('[data-test-summary]').hasText('NOT NOT U is k');
    assert.dom('[data-test-ids]').hasText('1,4,5,6');

    await click(`${inner} > .sui-qb-header .sui-qb-remove`);
    assert.dom('[data-test-summary]').hasText('everything');
  });

  test('value editors: option checkboxes, ranges and list conditions', async function (assert) {
    await renderBuilder();
    await click(footer(ROOT, 'condition'));
    await select(`${row(ROOT, 1)} .sui-qb-field`, 'tags');
    await select(`${row(ROOT, 1)} .sui-qb-operator`, 'in');
    await click(`${row(ROOT, 1)} .sui-qb-option:nth-child(2) input`); // B
    await click(`${row(ROOT, 1)} .sui-qb-option:nth-child(3) input`); // C
    assert.dom('[data-test-summary]').hasText('Tags is any of [B, C]');
    assert.dom('[data-test-ids]').hasText('2,4,5');

    await click(footer(ROOT, 'condition'));
    await select(`${row(ROOT, 2)} .sui-qb-field`, 'score');
    await select(`${row(ROOT, 2)} .sui-qb-operator`, 'between');
    await fillIn(`${row(ROOT, 2)} input[aria-label="From"]`, '30');
    // half-filled "between" stays "between" (it is { gte: 30 } until "To" is set)
    assert.dom(`${row(ROOT, 2)} .sui-qb-operator`).hasValue('between');
    await fillIn(`${row(ROOT, 2)} input[aria-label="To"]`, '50');
    assert
      .dom('[data-test-summary]')
      .hasText('Tags is any of [B, C] AND Score is between 30 and 50');
    assert.dom('[data-test-ids]').hasText('4,5');

    // switching to "is at least" keeps the lower bound
    await select(`${row(ROOT, 2)} .sui-qb-operator`, 'gte');
    assert
      .dom('[data-test-summary]')
      .hasText('Tags is any of [B, C] AND Score is at least 30');
    assert.dom(`${row(ROOT, 2)} .sui-qb-value input`).hasValue('30');
  });

  test('option values keep their type', async function (assert) {
    const fields: FieldSchema = {
      owner: {
        path: 'owner',
        type: 'keyword',
        label: 'Owner',
        options: [
          { value: 1, label: 'Ana' },
          { value: 2, label: 'Bo' },
        ],
      },
    };
    const d = driver;
    await render(
      <template>
        <Search @driver={{d}} as |search|>
          <QueryBuilder @search={{search}} @fields={{fields}} />
        </Search>
      </template>,
    );
    await click(footer(ROOT, 'condition'));
    await select(`${row(ROOT, 1)} .sui-qb-value select`, '2');
    const node = driver.state.filter.children[0];
    assert.strictEqual(node?.kind === 'condition' ? node.value : undefined, 2);
  });

  test('incomplete rows are skipped, not errors', async function (assert) {
    await renderBuilder();
    await click(footer(ROOT, 'condition'));
    assert.dom('[data-test-ids]').hasText('1,2,3,4,5,6');
    assert.strictEqual(driver.result.status, 'success');
    assert.strictEqual(driver.result.warnings.length, 1);
  });

  test('list conditions scope several conditions to one item', async function (assert) {
    await renderBuilder();
    await click(footer(ROOT, 'list'));
    const list = `${child(ROOT, 1)} > .sui-qb-nested`;
    const inner = `${list} > .sui-qb-group`;
    assert
      .dom(`${inner} > .sui-qb-header`)
      .includesText('of the Requirement fields');
    await setRow(row(inner, 1), 'kind', 'eq', 'permit');
    await click(footer(inner, 'condition'));
    await setRow(row(inner, 2), 'status', 'eq', 'fail');
    assert
      .dom('[data-test-summary]')
      .hasText(
        'some Requirement item where (Kind is permit AND Status is fail)',
      );
    assert.dom('[data-test-ids]').hasText('2,5');

    await select(
      `${list} > .sui-qb-header select[aria-label="Quantifier"]`,
      'none',
    );
    assert.dom('[data-test-ids]').hasText('1,3,4,6');
  });

  test('the builder follows changes made elsewhere', async function (assert) {
    await renderBuilder();
    driver.replaceFilter({
      kind: 'group',
      op: 'or',
      children: [
        { kind: 'condition', field: 'x', operator: 'eq', value: 'a' },
        {
          kind: 'condition',
          field: 'score',
          operator: 'range',
          value: { lt: 15 },
        },
      ],
    });
    await settled();
    assert
      .dom(
        `${ROOT} > .sui-qb-header .sui-qb-segmented button[aria-pressed="true"]`,
      )
      .hasText('any');
    assert.dom(`${row(ROOT, 1)} .sui-qb-value input`).hasValue('a');
    assert.dom(`${row(ROOT, 2)} .sui-qb-operator`).hasValue('lt');
    assert.dom('[data-test-ids]').hasText('1,6');
  });
});
