import { get } from '@ember/object';

/** Returns a function that reads `path` from its argument. */
export function pickValue(path: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (value: any): any => get(value, path);
}

export default pickValue;
