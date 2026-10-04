import type {
  DateValue,
  FilterValue,
  OperatorId,
  RangeValue,
} from './types.ts';

export interface EvaluationContext {
  /** Reference time for date math, in ms since the epoch. */
  now: number;
}

export interface OperatorDefinition {
  id: OperatorId;
  /** Is `value` a complete, valid value for this operator? */
  validate(value: unknown): boolean;
  /**
   * In-memory semantics, used by the evaluator and the memory backend.
   * `values` = the field's values in a document (arrays flattened,
   * null/undefined removed).
   */
  evaluate(
    values: readonly unknown[],
    value: FilterValue,
    ctx: EvaluationContext,
  ): boolean;
}

export class OperatorRegistry {
  #operators = new Map<OperatorId, OperatorDefinition>();

  constructor(operators: Iterable<OperatorDefinition> = BUILT_IN_OPERATORS) {
    for (const operator of operators) this.register(operator);
  }

  register(operator: OperatorDefinition): this {
    this.#operators.set(operator.id, operator);
    return this;
  }

  get(id: OperatorId): OperatorDefinition | undefined {
    return this.#operators.get(id);
  }

  has(id: OperatorId): boolean {
    return this.#operators.has(id);
  }

  ids(): OperatorId[] {
    return [...this.#operators.keys()];
  }
}

// --- values -------------------------------------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isDateValue = (value: unknown): value is DateValue =>
  isObject(value) &&
  Object.keys(value).length === 1 &&
  (typeof value['date'] === 'string' || typeof value['dateMath'] === 'string');

const isPrimitive = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' ||
  (typeof value === 'number' && !Number.isNaN(value)) ||
  typeof value === 'boolean';

/** A comparable value: string, number, boolean or a valid date. */
const isComparable = (value: unknown): boolean =>
  isPrimitive(value) ||
  (isDateValue(value) && resolveDate(value, { now: 0 }) !== undefined);

const RANGE_KEYS = ['gt', 'gte', 'lt', 'lte'] as const;

export const isRangeValue = (value: unknown): value is RangeValue =>
  isObject(value) &&
  !isDateValue(value) &&
  Object.keys(value).length > 0 &&
  Object.entries(value).every(
    ([key, bound]) =>
      (RANGE_KEYS as readonly string[]).includes(key) && isComparable(bound),
  );

const isNonEmptyScalarList = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value) && value.length > 0 && value.every(isPrimitive);

/**
 * A date-like object: a Date or anything with toISOString (moment, dayjs).
 * Returns its ISO string, or undefined when it is not one (or is invalid).
 */
export function dateLikeToISO(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const toISOString = (value as { toISOString?: unknown }).toISOString;
  if (typeof toISOString !== 'function') return undefined;
  try {
    const iso: unknown = toISOString.call(value);
    return typeof iso === 'string' ? iso : undefined;
  } catch {
    return undefined; // an invalid Date throws
  }
}

// --- dates ----------------------------------------------------------------

const UNITS = 'yMwdhms';

function roundDown(time: number, unit: string): number {
  const d = new Date(time);
  switch (unit) {
    case 'y':
      return Date.UTC(d.getUTCFullYear(), 0, 1);
    case 'M':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    case 'w': {
      // ISO weeks start on Monday
      const day = (d.getUTCDay() + 6) % 7;
      return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() - day,
      );
    }
    case 'd':
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    case 'h':
      return time - (time % 3_600_000);
    case 'm':
      return time - (time % 60_000);
    default:
      return time - (time % 1000);
  }
}

function add(time: number, amount: number, unit: string): number {
  const d = new Date(time);
  switch (unit) {
    case 'y':
      return d.setUTCFullYear(d.getUTCFullYear() + amount);
    case 'M':
      return d.setUTCMonth(d.getUTCMonth() + amount);
    case 'w':
      return time + amount * 7 * 86_400_000;
    case 'd':
      return time + amount * 86_400_000;
    case 'h':
      return time + amount * 3_600_000;
    case 'm':
      return time + amount * 60_000;
    default:
      return time + amount * 1000;
  }
}

/**
 * Resolves a date value to ms since the epoch, in UTC.
 * Date math follows Elasticsearch: `now`, `now-7d`, `now/M`, `now+1M/M`,
 * `2024-01-01||+1M`. Returns undefined when it cannot be parsed.
 */
export function resolveDate(
  value: DateValue,
  ctx: EvaluationContext,
): number | undefined {
  if ('date' in value) {
    const time = Date.parse(value.date);
    return Number.isNaN(time) ? undefined : time;
  }
  const expression = value.dateMath.trim();
  let anchor: number;
  let rest: string;
  if (expression.startsWith('now')) {
    anchor = ctx.now;
    rest = expression.slice(3);
  } else {
    const [base, math = ''] = expression.split('||');
    anchor = Date.parse(base ?? '');
    rest = math;
    if (Number.isNaN(anchor)) return undefined;
  }
  let time = anchor;
  const pattern = new RegExp(`([+-]\\d+[${UNITS}])|(\\/[${UNITS}])`, 'y');
  let index = 0;
  while (index < rest.length) {
    pattern.lastIndex = index;
    const match = pattern.exec(rest);
    if (!match) return undefined;
    const token = match[0];
    time = token.startsWith('/')
      ? roundDown(time, token.slice(1))
      : add(time, Number(token.slice(0, -1)), token.slice(-1));
    index += token.length;
  }
  return time;
}

// --- comparison -------------------------------------------------------------

/** Compares a document value with a filter value; NaN when incomparable. */
function compare(
  docValue: unknown,
  filterValue: unknown,
  ctx: EvaluationContext,
): number {
  if (isDateValue(filterValue)) {
    const right = resolveDate(filterValue, ctx);
    const left =
      typeof docValue === 'number'
        ? docValue
        : typeof docValue === 'string'
          ? Date.parse(docValue)
          : docValue instanceof Date
            ? docValue.getTime()
            : NaN;
    return right === undefined ? NaN : left - right;
  }
  if (typeof docValue === 'number' && typeof filterValue === 'number') {
    return docValue - filterValue;
  }
  if (typeof docValue === 'string' && typeof filterValue === 'string') {
    return docValue < filterValue ? -1 : docValue > filterValue ? 1 : 0;
  }
  if (typeof docValue === 'boolean' && typeof filterValue === 'boolean') {
    return Number(docValue) - Number(filterValue);
  }
  return NaN;
}

const equals = (a: unknown, b: unknown, ctx: EvaluationContext) =>
  compare(a, b, ctx) === 0;

// --- built-ins ----------------------------------------------------------------

export const eqOperator: OperatorDefinition = {
  id: 'eq',
  validate: isComparable,
  evaluate: (values, value, ctx) => values.some((v) => equals(v, value, ctx)),
};

export const inOperator: OperatorDefinition = {
  id: 'in',
  validate: isNonEmptyScalarList,
  evaluate: (values, value, ctx) =>
    (value as readonly unknown[]).some((wanted) =>
      values.some((v) => equals(v, wanted, ctx)),
    ),
};

export const allOperator: OperatorDefinition = {
  id: 'all',
  validate: isNonEmptyScalarList,
  evaluate: (values, value, ctx) =>
    (value as readonly unknown[]).every((wanted) =>
      values.some((v) => equals(v, wanted, ctx)),
    ),
};

export const rangeOperator: OperatorDefinition = {
  id: 'range',
  validate: isRangeValue,
  evaluate: (values, value, ctx) => {
    const { gt, gte, lt, lte } = value as RangeValue;
    return values.some((v) => {
      const checks: [unknown, (diff: number) => boolean][] = [
        [gt, (d) => d > 0],
        [gte, (d) => d >= 0],
        [lt, (d) => d < 0],
        [lte, (d) => d <= 0],
      ];
      return checks.every(
        ([bound, ok]) => bound === undefined || ok(compare(v, bound, ctx)),
      );
    });
  },
};

export const existsOperator: OperatorDefinition = {
  id: 'exists',
  validate: (value) => typeof value === 'boolean',
  evaluate: (values, value) => values.length > 0 === value,
};

const nonEmptyString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

/** Case-insensitive substring match, an approximation of full-text search. */
export const containsOperator: OperatorDefinition = {
  id: 'contains',
  validate: nonEmptyString,
  evaluate: (values, value) => {
    const needle = (value as string).toLowerCase();
    return values.some(
      (v) => typeof v === 'string' && v.toLowerCase().includes(needle),
    );
  },
};

export const prefixOperator: OperatorDefinition = {
  id: 'prefix',
  validate: nonEmptyString,
  evaluate: (values, value) =>
    values.some((v) => typeof v === 'string' && v.startsWith(value as string)),
};

/** Deep equality of plain data (JSON-like values). */
const sameData = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * A value passed through verbatim to the backend, for wire shapes the
 * driver has no operator for (search-ui apps can set any filter value).
 * In memory it matches documents holding an equal value.
 */
export const rawOperator: OperatorDefinition = {
  id: 'raw',
  validate: (value) => value !== undefined,
  evaluate: (values, value) => values.some((v) => sameData(v, value)),
};

export const BUILT_IN_OPERATORS: readonly OperatorDefinition[] = [
  rawOperator,
  eqOperator,
  inOperator,
  allOperator,
  rangeOperator,
  existsOperator,
  containsOperator,
  prefixOperator,
];
