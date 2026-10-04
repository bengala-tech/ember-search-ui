import {
  isDateValue,
  type ConditionNode,
  type DateValue,
  type FieldDefinition,
  type FilterValue,
  type OperatorId,
  type RangeValue,
  type Scalar,
} from 'ember-search-ui-driver';

// What a person picks in the builder ("is", "between", "has a value"...),
// mapped onto a driver operator and value shape. "Not" is not a condition:
// it is the NOT toggle on any row or group.

export type ValueShape =
  | 'none' // exists / missing
  | 'single' // one value
  | 'list' // several values
  | 'bound' // one range bound (gt, gte, lt, lte)
  | 'between'; // gte + lte

export type Bound = 'gt' | 'gte' | 'lt' | 'lte';

export interface ConditionKind {
  id: string;
  label: string;
  operator: OperatorId;
  shape: ValueShape;
  /** For `bound`: which side. */
  bound?: Bound;
  /** For `none`: the exists value. */
  exists?: boolean;
}

export const CONDITIONS: Record<string, ConditionKind> = {
  eq: { id: 'eq', label: 'is', operator: 'eq', shape: 'single' },
  in: { id: 'in', label: 'is any of', operator: 'in', shape: 'list' },
  all: { id: 'all', label: 'has all of', operator: 'all', shape: 'list' },
  contains: {
    id: 'contains',
    label: 'contains',
    operator: 'contains',
    shape: 'single',
  },
  prefix: {
    id: 'prefix',
    label: 'starts with',
    operator: 'prefix',
    shape: 'single',
  },
  gt: {
    id: 'gt',
    label: 'is greater than',
    operator: 'range',
    shape: 'bound',
    bound: 'gt',
  },
  gte: {
    id: 'gte',
    label: 'is at least',
    operator: 'range',
    shape: 'bound',
    bound: 'gte',
  },
  lt: {
    id: 'lt',
    label: 'is less than',
    operator: 'range',
    shape: 'bound',
    bound: 'lt',
  },
  lte: {
    id: 'lte',
    label: 'is at most',
    operator: 'range',
    shape: 'bound',
    bound: 'lte',
  },
  between: {
    id: 'between',
    label: 'is between',
    operator: 'range',
    shape: 'between',
  },
  exists: {
    id: 'exists',
    label: 'has a value',
    operator: 'exists',
    shape: 'none',
    exists: true,
  },
  missing: {
    id: 'missing',
    label: 'is empty',
    operator: 'exists',
    shape: 'none',
    exists: false,
  },
};

const DATE_LABELS: Partial<Record<string, string>> = {
  gt: 'is after',
  gte: 'is on or after',
  lt: 'is before',
  lte: 'is on or before',
};

const BY_TYPE: Record<string, string[]> = {
  keyword: ['eq', 'in', 'all', 'prefix', 'exists', 'missing'],
  text: ['contains', 'eq', 'prefix', 'exists', 'missing'],
  number: [
    'eq',
    'between',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'exists',
    'missing',
  ],
  date: ['between', 'gt', 'gte', 'lt', 'lte', 'eq', 'exists', 'missing'],
  boolean: ['eq', 'exists', 'missing'],
};

/** The conditions offered for a field, in menu order. */
export function conditionsFor(
  field: FieldDefinition | undefined,
): ConditionKind[] {
  const ids = BY_TYPE[field?.type ?? 'keyword'] ?? BY_TYPE['keyword']!;
  const allowed = field?.operators;
  return ids
    .map((id) => CONDITIONS[id]!)
    .filter((c) => !allowed || allowed.includes(c.operator))
    .map((c) =>
      field?.type === 'date' && DATE_LABELS[c.id]
        ? { ...c, label: DATE_LABELS[c.id]! }
        : c,
    );
}

/**
 * Which condition a node currently expresses. The builder records the
 * condition picked in `meta.condition`, because some values are ambiguous
 * on their own: "between" with only its lower bound is `{ gte: 30 }`, the
 * same as "is at least 30". The recorded one wins while it still fits.
 */
export function conditionOf(
  node: Pick<ConditionNode, 'operator' | 'value'> &
    Partial<Pick<ConditionNode, 'meta'>>,
): ConditionKind {
  const recorded =
    CONDITIONS[(node.meta?.['condition'] as string | undefined) ?? ''];
  if (recorded && fits(recorded, node)) return recorded;
  return inferCondition(node);
}

function fits(
  kind: ConditionKind,
  node: Pick<ConditionNode, 'operator' | 'value'>,
): boolean {
  if (kind.operator !== node.operator) return false;
  const keys = Object.keys((node.value as object | null | undefined) ?? {});
  switch (kind.shape) {
    case 'none':
      return node.value === kind.exists;
    case 'bound':
      return keys.every((k) => k === kind.bound);
    case 'between':
      return keys.every((k) => k === 'gte' || k === 'lte');
    default:
      return true;
  }
}

function inferCondition(
  node: Pick<ConditionNode, 'operator' | 'value'>,
): ConditionKind {
  if (node.operator === 'exists') {
    return node.value === false
      ? CONDITIONS['missing']!
      : CONDITIONS['exists']!;
  }
  if (node.operator === 'range') {
    const keys = Object.keys((node.value as object | undefined) ?? {});
    if (keys.length === 1 && CONDITIONS[keys[0]!]) return CONDITIONS[keys[0]!]!;
    return CONDITIONS['between']!;
  }
  return (
    CONDITIONS[node.operator] ?? {
      id: node.operator,
      label: node.operator,
      operator: node.operator,
      shape: 'single',
    }
  );
}

/**
 * Operator and value after switching to `next`, keeping what still fits:
 * "is 5" -> "is any of [5]", "is any of [5, 6]" -> "is 5", a bound -> another bound.
 */
export function switchCondition(
  node: Pick<ConditionNode, 'operator' | 'value'>,
  next: ConditionKind,
): { operator: OperatorId; value: FilterValue | undefined } {
  const current = conditionOf(node);
  const singles = singleValues(node.value, current);
  const first = singles[0];
  switch (next.shape) {
    case 'none':
      return { operator: next.operator, value: next.exists ?? true };
    case 'single':
      return { operator: next.operator, value: first };
    case 'list':
      return {
        operator: next.operator,
        value: singles.length ? singles : undefined,
      };
    case 'bound':
      return {
        operator: next.operator,
        value: first === undefined ? undefined : { [next.bound!]: first },
      };
    case 'between': {
      const range = (
        current.shape === 'between' ? node.value : {}
      ) as RangeValue;
      return {
        operator: next.operator,
        value:
          current.shape === 'between'
            ? range
            : first === undefined
              ? undefined
              : { gte: first },
      };
    }
  }
}

/** The plain values a condition holds, for carrying them across conditions. */
function singleValues(
  value: FilterValue | undefined,
  kind: ConditionKind,
): (Scalar | DateValue)[] {
  if (value === undefined || value === null) return [];
  switch (kind.shape) {
    case 'none':
      return [];
    case 'list':
      return (value as (Scalar | DateValue)[]).slice();
    case 'bound':
      return [(value as RangeValue)[kind.bound!]].filter(
        (v): v is Scalar | DateValue => v !== undefined,
      );
    case 'between': {
      const { gte, lte } = value as RangeValue;
      return [gte, lte].filter((v): v is Scalar | DateValue => v !== undefined);
    }
    default:
      return typeof value === 'object' && !isDateValue(value) ? [] : [value];
  }
}

/**
 * Converts what an input produced into a filter value for the field.
 * Empty input -> undefined (an incomplete condition, skipped by searches).
 */
export function parseInput(
  raw: string,
  field: FieldDefinition | undefined,
): Scalar | DateValue | undefined {
  const text = raw.trim();
  if (text === '') return undefined;
  switch (field?.type) {
    case 'number': {
      const n = Number(text);
      return Number.isNaN(n) ? undefined : n;
    }
    case 'boolean':
      return text === 'true' ? true : text === 'false' ? false : undefined;
    case 'date':
      return text.startsWith('now') || text.includes('||')
        ? { dateMath: text }
        : { date: text };
    default:
      return text;
  }
}

/** The text an input shows for a value. */
export function formatInput(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (isDateValue(value)) return 'date' in value ? value.date : value.dateMath;
  // scalars only reach here (strings, numbers, booleans)
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

/** Relative dates offered next to date inputs. */
export const DATE_PRESETS: readonly { label: string; value: string }[] = [
  { label: 'now', value: 'now' },
  { label: 'start of today', value: 'now/d' },
  { label: 'start of this week', value: 'now/w' },
  { label: 'start of this month', value: 'now/M' },
  { label: 'start of next month', value: 'now+1M/M' },
  { label: '7 days ago', value: 'now-7d/d' },
  { label: '30 days ago', value: 'now-30d/d' },
  { label: 'start of this year', value: 'now/y' },
];
