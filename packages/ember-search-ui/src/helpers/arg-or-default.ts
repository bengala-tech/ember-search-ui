import { assert } from '@ember/debug';

/**
 * Returns `defaultValue` when `value` is undefined (null is a real value).
 */
export function argOrDefault<T, D>([value, defaultValue]: [T | undefined, D]):
  T | D {
  assert('`defaultValue` must be provided', defaultValue !== undefined);
  return value !== undefined ? value : defaultValue;
}

export function argOrDefaultDecorator(defaultValue: unknown) {
  return function (_target: object, key: string) {
    return {
      get(this: { args: Record<string, unknown> }) {
        const value = this.args[key];
        return value !== undefined ? value : defaultValue;
      },
    };
  };
}

export default function argOrDefaultHelper<T, D>(
  value: T | undefined,
  defaultValue: D,
): T | D {
  return argOrDefault([value, defaultValue]);
}
