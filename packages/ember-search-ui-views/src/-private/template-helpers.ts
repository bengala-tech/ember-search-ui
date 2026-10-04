// Small, typed stand-ins for the ember-composable-helpers / ember-truth-helpers /
// ember-math-helpers / ember-event-helpers the classic templates relied on.

export const eq = (a: unknown, b: unknown): boolean => a === b;
export const not = (value: unknown): boolean => !value;
export const and = (...values: unknown[]): boolean => values.every(Boolean);
export const gt = (a: number, b: number): boolean => a > b;
export const gte = (a: number, b: number): boolean => a >= b;
export const add = (a: number, b: number): number => a + b;

export const includes = (needle: unknown, haystack: unknown[] | undefined) =>
  (haystack ?? []).includes(needle);

export const findBy = <T>(
  key: keyof T,
  value: unknown,
  list: T[] | undefined,
) => (list ?? []).find((item) => item[key] === value);

/** `range(0, 3)` → `[0, 1, 2]` */
export const range = (start: number, end: number): number[] =>
  end > start ? Array.from({ length: end - start }, (_, i) => start + i) : [];

/** Wraps a possibly-undefined action so `{{on}}` always gets a function. */
export const optional =
  <A extends unknown[]>(action: ((...args: A) => unknown) | undefined) =>
  (...args: A) =>
    action?.(...args);

/** Like ember-composable-helpers' `pipe`: feeds each result into the next action. */
export function pipe<A extends unknown[]>(
  first: (...args: A) => unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rest: ((value: any) => unknown)[]
) {
  return (...args: A): unknown =>
    rest.reduce<unknown>(
      (acc, next) => (acc instanceof Promise ? acc.then(next) : next(acc)),
      first(...args),
    );
}

export const preventDefault =
  <T>(action: (event: Event) => T) =>
  (event: Event): T => {
    event.preventDefault();
    return action(event);
  };
