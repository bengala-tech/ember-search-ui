import {
  and,
  anyOf,
  contains,
  date,
  dateMath,
  disabled,
  eq,
  exists,
  not,
  or,
  range,
  type GroupInput,
} from 'ember-search-ui-driver';

// Ready-made filters over the demo inspections, from simple to tricky, to
// show the query builder and every serialized form without inventing them.

export interface FilterPreset {
  id: string;
  title: string;
  /** What it shows off. */
  note: string;
  filter: GroupInput;
}

export const PRESETS: FilterPreset[] = [
  {
    id: 'open-high',
    title: 'Open and high priority',
    note: 'A plain AND of two conditions: even the legacy list format can send it.',
    filter: and(
      anyOf('state', ['created', 'pending', 'in_progress']),
      eq('priority', 'high'),
    ),
  },
  {
    id: 'closed-elsewhere',
    title: 'Closed, outside Monterrey',
    note: 'NOT on one condition. The groups format sends it as __negate.',
    filter: and(
      anyOf('state', ['done', 'cancelled']),
      not(eq('project', 'Monterrey plant')),
    ),
  },
  {
    id: 'expensive-or-overdue',
    title: 'Expensive, or overdue and still open',
    note: 'OR at the top, with an AND group and a relative date (now) inside.',
    filter: or(
      range('cost', { gte: 3000 }),
      and(
        range('due_at', { lt: dateMath('now') }),
        not(anyOf('state', ['done', 'cancelled'])),
      ),
    ),
  },
  {
    id: 'fire-season',
    title: 'Fire and safety checks, June to August',
    note: 'A multi-value condition and a date range between two fixed dates.',
    filter: and(
      anyOf('tags', ['fire', 'safety']),
      range('created_at', { gte: date('2026-06-01'), lt: date('2026-09-01') }),
    ),
  },
  {
    id: 'two-shapes',
    title: '(High and pending) or (low and done), with a cost',
    note: 'Groups nested two levels deep, and an "has a value" condition.',
    filter: and(
      or(
        and(eq('priority', 'high'), eq('state', 'pending')),
        and(eq('priority', 'low'), eq('state', 'done')),
      ),
      exists('cost'),
    ),
  },
  {
    id: 'leaks',
    title: 'Leaks reported, but not in a kitchen',
    note: 'Text search on two fields, one of them negated.',
    filter: and(
      contains('description', 'leak'),
      not(contains('title', 'kitchen')),
    ),
  },
  {
    id: 'switched-off',
    title: 'Saltillo, with a group switched off',
    note: 'The OR group is off: it has no effect and is left out of the request, but stays in the tree to switch back on.',
    filter: and(
      eq('project', 'Saltillo warehouse'),
      disabled(or(eq('priority', 'low'), eq('state', 'done'))),
    ),
  },
  {
    id: 'recent',
    title: 'Created in the 90 days before September 30',
    note: 'Date math anchored to a date (2026-09-30||-90d), resolved by the backend.',
    filter: and(range('created_at', { gte: dateMath('2026-09-30||-90d') })),
  },
];
