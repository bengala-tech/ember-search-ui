import {
  and,
  nested,
  or,
  where,
  type ConditionInput,
  type ConditionNode,
  type FieldDefinition,
  type FieldSchema,
  type FilterNode,
  type GroupNode,
  type NestedNode,
  type NodeId,
  type RangeValue,
  type Scalar,
  type SearchDriver,
} from 'ember-search-ui-driver';
import {
  conditionOf,
  conditionsFor,
  formatInput,
  parseInput,
  switchCondition,
  type Bound,
} from './conditions.ts';

// Everything the builder does to the tree, as plain functions over a driver.

type Driver = Pick<SearchDriver<unknown>, 'add' | 'update' | 'remove'>;

const inputValue = (event: Event) =>
  (event.target as HTMLInputElement | HTMLSelectElement).value;

/** Fields a condition row can use (nested lists get their own scope). */
export const conditionFields = (fields: FieldSchema): FieldDefinition[] =>
  Object.values(fields).filter((f) => !f.nested);

export const nestedFields = (fields: FieldSchema): FieldDefinition[] =>
  Object.values(fields).filter((f) => f.nested);

/** A new row: the first field, its first condition, no value yet. */
export function newCondition(fields: FieldSchema): ConditionInput {
  const field = conditionFields(fields)[0];
  const kind = conditionsFor(field)[0]!;
  return where(
    field?.path ?? '',
    kind.operator,
    kind.shape === 'none' ? kind.exists : undefined,
  );
}

export const addCondition = (
  driver: Driver,
  parent: GroupNode,
  fields: FieldSchema,
) => driver.add(parent.id, newCondition(fields));

export const addGroup = (
  driver: Driver,
  parent: GroupNode,
  fields: FieldSchema,
) =>
  // the opposite op reads naturally: an OR inside an AND and vice versa
  driver.add(
    parent.id,
    parent.op === 'and' ? or(newCondition(fields)) : and(newCondition(fields)),
  );

export function addNested(
  driver: Driver,
  parent: GroupNode,
  fields: FieldSchema,
) {
  const list = nestedFields(fields)[0];
  if (!list) return;
  driver.add(
    parent.id,
    nested(list.path, and(newCondition(list.fields ?? {}))),
  );
}

export const setOp = (driver: Driver, group: GroupNode, op: 'and' | 'or') =>
  driver.update(group.id, { op });

export const remove = (driver: Driver, node: FilterNode) =>
  driver.remove(node.id);

export function setField(
  driver: Driver,
  node: ConditionNode,
  fields: FieldSchema,
  event: Event,
) {
  const path = inputValue(event);
  const kind = conditionsFor(fields[path])[0]!;
  driver.update(node.id, {
    field: path,
    operator: kind.operator,
    value: kind.shape === 'none' ? kind.exists : undefined,
    meta: { ...node.meta, condition: kind.id },
  });
}

export function setCondition(
  driver: Driver,
  node: ConditionNode,
  field: FieldDefinition | undefined,
  event: Event,
) {
  const next = conditionsFor(field).find((c) => c.id === inputValue(event));
  if (!next) return;
  driver.update(node.id, {
    ...switchCondition(node, next),
    meta: { ...node.meta, condition: next.id },
  });
}

/** One value (eq, contains, prefix): from a text, number, date or select input. */
export function setSingle(
  driver: Driver,
  node: ConditionNode,
  field: FieldDefinition | undefined,
  event: Event,
) {
  const raw = inputValue(event);
  // option values keep their type (an option `3` is the number 3, not "3")
  const option = field?.options?.find((o) => formatInput(o.value) === raw);
  driver.update(node.id, {
    value: option ? option.value : parseInput(raw, field),
  });
}

/** One side of a range: a bound condition, or either end of "between". */
export function setBound(
  driver: Driver,
  node: ConditionNode,
  field: FieldDefinition | undefined,
  bound: Bound,
  event: Event,
) {
  const kind = conditionOf(node);
  const current =
    kind.shape === 'between' ? ((node.value ?? {}) as RangeValue) : {};
  const next: Record<string, unknown> = { ...current };
  const value = parseInput(inputValue(event), field);
  if (value === undefined) delete next[bound];
  else next[bound] = value;
  driver.update(node.id, {
    value: Object.keys(next).length ? next : undefined,
  });
}

/** A typed value: a range side when `side` is given, else the single value. */
export function setScalar(
  driver: Driver,
  node: ConditionNode,
  field: FieldDefinition | undefined,
  side: Bound | undefined,
  event: Event,
) {
  if (side) setBound(driver, node, field, side, event);
  else setSingle(driver, node, field, event);
}

/** A relative date picked from the presets ("" clears it). */
export function setDateMath(
  driver: Driver,
  node: ConditionNode,
  bound: Bound | undefined,
  event: Event,
) {
  const expression = inputValue(event);
  const date = expression ? { dateMath: expression } : undefined;
  if (!bound) {
    driver.update(node.id, { value: date });
    return;
  }
  const kind = conditionOf(node);
  const next: Record<string, unknown> = {
    ...(kind.shape === 'between' ? ((node.value ?? {}) as RangeValue) : {}),
  };
  if (date) next[bound] = date;
  else delete next[bound];
  driver.update(node.id, {
    value: Object.keys(next).length ? next : undefined,
  });
}

/** A list typed as comma-separated text. */
export function setListText(
  driver: Driver,
  node: ConditionNode,
  field: FieldDefinition | undefined,
  event: Event,
) {
  const values = inputValue(event)
    .split(',')
    .map((part) => parseInput(part, field))
    .filter(
      (v): v is Scalar =>
        v !== undefined && (typeof v !== 'object' || v === null),
    );
  driver.update(node.id, { value: values.length ? values : undefined });
}

/** A list picked with checkboxes. */
export function toggleListValue(
  driver: Driver,
  node: ConditionNode,
  value: Scalar,
  event: Event,
) {
  const checked = (event.target as HTMLInputElement).checked;
  const current = ((node.value as Scalar[] | undefined) ?? []).filter(
    (v) => v !== value,
  );
  const next = checked ? [...current, value] : current;
  driver.update(node.id, { value: next.length ? next : undefined });
}

export function setNestedPath(
  driver: Driver,
  node: NestedNode,
  fields: FieldSchema,
  event: Event,
) {
  const path = inputValue(event);
  driver.update(node.id, { path });
  // the old conditions refer to the old item fields: start over
  for (const child of node.filter.children) driver.remove(child.id);
  driver.add(node.filter.id, newCondition(fields[path]?.fields ?? {}));
}

export const setQuantifier = (driver: Driver, node: NestedNode, event: Event) =>
  driver.update(node.id, {
    quantifier: inputValue(event) as NestedNode['quantifier'],
  });

export type { NodeId };
