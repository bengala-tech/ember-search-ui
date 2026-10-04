import type {
  ConditionInput,
  DateValue,
  FieldPath,
  FilterValue,
  GroupInput,
  NestedInput,
  NodeId,
  NodeInput,
  OperatorId,
  RangeValue,
  Scalar,
} from './types.ts';

// Builders return node inputs (ids optional). They nest freely:
//
//   or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c')))
//
// reads "(x is b and u is k) or (t is k and x is c)".

export const and = (...children: NodeInput[]): GroupInput => ({
  kind: 'group',
  op: 'and',
  children,
});

export const or = (...children: NodeInput[]): GroupInput => ({
  kind: 'group',
  op: 'or',
  children,
});

/** Wraps the node's meaning: NOT (node). Applying it twice cancels out. */
export const not = <T extends NodeInput>(node: T): T => ({
  ...node,
  negate: !node.negate,
});

/** Keeps the node in the tree but out of the search. */
export const disabled = <T extends NodeInput>(node: T): T => ({
  ...node,
  disabled: true,
});

/** Gives a node a fixed id, e.g. `facet:states`. */
export const withId = <T extends NodeInput>(id: NodeId, node: T): T => ({
  ...node,
  id,
});

export const where = (
  field: FieldPath,
  operator: OperatorId,
  value?: FilterValue,
): ConditionInput =>
  value === undefined
    ? { kind: 'condition', field, operator }
    : { kind: 'condition', field, operator, value };

export const eq = (field: FieldPath, value: Scalar | DateValue) =>
  where(field, 'eq', value);

/** Field equals any of the values. */
export const anyOf = (field: FieldPath, values: readonly Scalar[]) =>
  where(field, 'in', values);

/** Multi-valued field contains every value. */
export const allOf = (field: FieldPath, values: readonly Scalar[]) =>
  where(field, 'all', values);

export const range = (field: FieldPath, bounds: RangeValue) =>
  where(field, 'range', bounds);

export const exists = (field: FieldPath, present = true) =>
  where(field, 'exists', present);

export const contains = (field: FieldPath, text: string) =>
  where(field, 'contains', text);

export const prefix = (field: FieldPath, text: string) =>
  where(field, 'prefix', text);

/** A value sent to the backend as is, for shapes no operator covers. */
export const raw = (field: FieldPath, value: unknown) =>
  where(field, 'raw', value as FilterValue);

/**
 * "Items of the list at `path` match `filter`". Fields inside are relative
 * to `path`: nested('requirements', and(eq('status', 'ok'), ...)).
 */
export const nested = (
  path: FieldPath,
  filter: NodeInput,
  quantifier: NestedInput['quantifier'] = 'some',
): NestedInput => ({
  kind: 'nested',
  path,
  quantifier,
  filter: filter.kind === 'group' ? filter : and(filter),
});

export const date = (iso: string): DateValue => ({ date: iso });

/** Elasticsearch-style date math: `now`, `now-7d`, `now/M`, `now+1M/M`. */
export const dateMath = (expression: string): DateValue => ({
  dateMath: expression,
});
