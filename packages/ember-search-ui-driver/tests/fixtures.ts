// Documents for "(x is b and u is k) or (t is k and x is c)", one per case.
export const XUT_DOCS = [
  { id: 1, x: 'b', u: 'k', t: 'z' }, // first branch
  { id: 2, x: 'c', u: 'z', t: 'k' }, // second branch
  { id: 3, x: 'b', u: 'z', t: 'k' }, // x is b but u is not k; t is k but x is not c
  { id: 4, x: 'c', u: 'k', t: 'z' }, // x is c but t is not k; u is k but x is not b
  { id: 5, x: 'b', u: 'k', t: 'k' }, // first branch (and t is k)
  { id: 6, x: 'a', u: 'k', t: 'k' }, // neither: x is a
];

export interface Park {
  id: number;
  title: string;
  states: string[];
  visitors: number;
  established: string;
  description: string;
  meta?: { featured?: boolean };
  requirements: { kind: string; status: string; due?: string }[];
}

export const PARKS: Park[] = [
  {
    id: 1,
    title: 'Yosemite',
    states: ['California'],
    visitors: 3_900_000,
    established: '1890-10-01',
    description: 'Granite cliffs and giant sequoias',
    meta: { featured: true },
    requirements: [
      { kind: 'permit', status: 'ok', due: '2026-01-10' },
      { kind: 'fire', status: 'fail' },
    ],
  },
  {
    id: 2,
    title: 'Yellowstone',
    states: ['Wyoming', 'Montana', 'Idaho'],
    visitors: 4_500_000,
    established: '1872-03-01',
    description: 'Geysers, hot springs and bison',
    requirements: [{ kind: 'permit', status: 'fail' }],
  },
  {
    id: 3,
    title: 'Zion',
    states: ['Utah'],
    visitors: 4_600_000,
    established: '1919-11-19',
    description: 'Red rock canyons',
    requirements: [
      { kind: 'permit', status: 'ok' },
      { kind: 'fire', status: 'ok' },
    ],
  },
  {
    id: 4,
    title: 'Joshua Tree',
    states: ['California'],
    visitors: 3_000_000,
    established: '1994-10-31',
    description: 'Desert where two deserts meet',
    requirements: [],
  },
  {
    id: 5,
    title: 'Acadia',
    states: ['Maine'],
    visitors: 4_000_000,
    established: '1916-07-08',
    description: 'Rocky Atlantic coast',
    meta: { featured: false },
    requirements: [{ kind: 'fire', status: 'fail' }],
  },
];

export const ids = (docs: readonly { id: number }[]) => docs.map((d) => d.id);
