import { afterEach, describe, expect, test } from 'vitest';
import {
  SearchDriver,
  defineProperty,
  legacyChipValues,
  legacyEditorValue,
  legacyValuePatch,
  memoryBackend,
  propertyFilter,
  searchUiCompat,
  setPropertyFilter,
  type LegacyProperty,
} from '../src/index.ts';

interface Doc {
  id: number;
  state: string;
  cost: number;
}
const DOCS: Doc[] = [
  { id: 1, state: 'open', cost: 10 },
  { id: 2, state: 'closed', cost: 200 },
  { id: 3, state: 'open', cost: 500 },
];

const state = defineProperty<Doc>({
  label: 'State',
  field: { path: 'state', type: 'keyword' },
});
const cost = defineProperty<Doc>({
  label: 'Cost',
  field: { path: 'cost', type: 'number' },
});
const legacyState: LegacyProperty = { name: 'State', valuePath: 'state' };

const drivers: SearchDriver<Doc>[] = [];
afterEach(() => drivers.splice(0).forEach((d) => d.destroy()));

function driver() {
  const d = new SearchDriver<Doc>({ backend: memoryBackend(DOCS) });
  drivers.push(d);
  return d;
}
const ids = (d: SearchDriver<Doc>) => d.result.results.map((r) => r.id);

describe('the flat filter-bar condition', () => {
  test('set, change and remove a property filter', async () => {
    const d = driver();
    setPropertyFilter(d, state, { value: 'open' }); // default operator: eq
    await d.settled();
    expect(d.state.filter.children).toHaveLength(1);
    expect(propertyFilter(d.state, state)).toMatchObject({
      field: 'state',
      operator: 'eq',
      value: 'open',
    });
    expect(ids(d)).toEqual([1, 3]);

    setPropertyFilter(d, cost, { operator: 'range', value: { gte: 100 } });
    setPropertyFilter(d, state, { negate: true });
    await d.settled();
    expect(ids(d)).toEqual([2]);

    setPropertyFilter(d, state, undefined);
    await d.settled();
    expect(propertyFilter(d.state, state)).toBeUndefined();
    expect(ids(d)).toEqual([2, 3]);
    setPropertyFilter(d, state, undefined); // removing twice is fine
  });

  test('legacy setFilter and the filter bar edit the same node', async () => {
    const d = driver();
    const compat = searchUiCompat(d);
    compat.setFilter('state', 'closed', 'any');
    expect(propertyFilter(d.state, legacyState)?.value).toBe('closed');
    setPropertyFilter(d, legacyState, { value: 'open' });
    await d.settled();
    expect(compat.getState().filters).toEqual([
      { field: 'state', values: ['open'], type: 'any' },
    ]);
  });

  test('a non-filterable property cannot get a new filter', () => {
    const hidden = defineProperty({
      label: 'Hidden',
      field: { path: 'secret', type: 'keyword' },
      filter: false,
    });
    expect(() => setPropertyFilter(driver(), hidden, { value: 1 })).toThrow(
      'not filterable',
    );
  });
});

describe('legacy editor values', () => {
  test('editors get what setFilter received; chips get filter.values', () => {
    const d = driver();
    const compat = searchUiCompat(d, { arrays: 'keep' });
    compat.setFilter('state', ['open', 'closed'], 'any');
    const node = propertyFilter(d.state, legacyState);
    expect(legacyEditorValue(node)).toEqual(['open', 'closed']);
    expect(legacyChipValues(node)).toEqual([['open', 'closed']]);

    compat.setFilter('cost', { gte: 100 }, 'any');
    const costNode = propertyFilter(d.state, {
      name: 'Cost',
      valuePath: 'cost',
    });
    expect(legacyEditorValue(costNode)).toEqual({ gte: 100 });
    expect(legacyEditorValue(undefined)).toBeUndefined();
    expect(legacyChipValues(undefined)).toEqual([]);
  });

  test('an editor value back into a patch, like setFilter(field, value, "any")', async () => {
    expect(legacyValuePatch(legacyState, '')).toBeUndefined();
    expect(legacyValuePatch(legacyState, [])).toBeUndefined();
    expect(legacyValuePatch(legacyState, 'open')).toMatchObject({
      operator: 'eq',
      value: 'open',
    });
    expect(legacyValuePatch(legacyState, ['open', 'closed'])).toMatchObject({
      operator: 'in',
      value: ['open', 'closed'],
      meta: undefined,
    });
    expect(
      legacyValuePatch(legacyState, ['open'], { arrays: 'keep' }),
    ).toMatchObject({ meta: { 'searchUi.arrayValue': true } });

    const d = driver();
    setPropertyFilter(d, legacyState, legacyValuePatch(legacyState, ['open']));
    await d.settled();
    expect(ids(d)).toEqual([1, 3]);
  });
});
