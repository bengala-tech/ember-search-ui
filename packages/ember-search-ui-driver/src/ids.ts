import type { NodeId } from './types.ts';

export type IdFactory = () => NodeId;

/** Short random ids: `n-k3x9f2`. Collisions are checked when nodes enter a tree. */
export const randomIds: IdFactory = () =>
  `n-${Math.random().toString(36).slice(2, 10)}`;

/** Deterministic ids for tests and fixtures: `prefix1`, `prefix2`, ... */
export function sequentialIds(prefix = 'n'): IdFactory {
  let next = 0;
  return () => `${prefix}${++next}`;
}
