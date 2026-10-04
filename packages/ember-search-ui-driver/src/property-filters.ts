import type { SearchDriver } from './driver.ts';
import { defaultOperator } from './property.ts';
import { toProperty, type AnyProperty } from './legacy-property.ts';
import {
  ARRAY_VALUE_META,
  filterNodeId,
  filterToNode,
  nodeToFilter,
  type SearchUiCompatOptions,
} from './compat/search-ui.ts';
import { ROOT_ID, type ConditionPatch } from './tree.ts';
import type { ConditionNode, SearchState } from './types.ts';

// The flat filter-bar convention: one condition per property, directly
// under the root, with the id `filter:<key>`. It is the same node the
// search-ui compat layer edits with setFilter(field, ...), so a filter bar,
// legacy code calling setFilter and a QueryBuilder over the rest of the tree
// all work on one state.

/** The id of a property's filter-bar condition. */
export const propertyFilterId = (property: AnyProperty<never, unknown>) =>
  filterNodeId(toProperty(property).key);

/** The property's filter-bar condition, if set. */
export function propertyFilter(
  state: SearchState,
  property: AnyProperty<never, unknown>,
): ConditionNode | undefined {
  const id = propertyFilterId(property);
  const node = state.filter.children.find((child) => child.id === id);
  return node?.kind === 'condition' ? node : undefined;
}

/**
 * Sets, changes or (with `undefined`) removes a property's filter-bar
 * condition. A new condition starts with the property's default operator
 * unless the patch names one.
 */
export function setPropertyFilter<Doc>(
  driver: SearchDriver<Doc>,
  property: AnyProperty<never, unknown>,
  patch: ConditionPatch | undefined,
): void {
  const id = propertyFilterId(property);
  const current = propertyFilter(driver.state, property);
  if (!patch) {
    if (current) driver.remove(id);
    return;
  }
  if (current) {
    driver.update(id, patch);
    return;
  }
  const { field } = toProperty(property);
  const operator = patch.operator ?? defaultOperator(property);
  if (!operator) {
    throw new TypeError(
      `Property "${toProperty(property).key}" is not filterable`,
    );
  }
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as ConditionPatch;
  driver.add(ROOT_ID, {
    kind: 'condition',
    id,
    field: field.path,
    ...defined,
    operator,
  });
}

// --- legacy editors -------------------------------------------------------------

/**
 * The value a legacy filter editor gets as `@value`: what was passed to
 * setFilter (one value, or the array of values).
 */
export function legacyEditorValue(node: ConditionNode | undefined): unknown {
  if (!node) return undefined;
  const { values } = nodeToFilter(node);
  return values.length === 1 ? values[0] : values;
}

/** The values a legacy chip gets as `@value` (search-ui's `filter.values`). */
export function legacyChipValues(node: ConditionNode | undefined): unknown[] {
  return node ? nodeToFilter(node).values : [];
}

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * A legacy editor's value as a condition patch, read the way search-ui's
 * setFilter(field, value, 'any') reads it; `undefined` for a blank value
 * (which removes the filter).
 */
export function legacyValuePatch(
  property: AnyProperty<never, unknown>,
  value: unknown,
  options: SearchUiCompatOptions = {},
): ConditionPatch | undefined {
  if (isBlank(value)) return undefined;
  const { field } = toProperty(property);
  const keep = options.arrays === 'keep';
  const node = filterToNode({
    field: field.path,
    values: !keep && Array.isArray(value) ? value : [value],
    type: 'any',
  });
  if (!node) return undefined;
  return {
    operator: node.operator,
    value: node.value,
    negate: undefined,
    meta: node.meta?.[ARRAY_VALUE_META]
      ? { [ARRAY_VALUE_META]: true }
      : undefined,
  };
}
