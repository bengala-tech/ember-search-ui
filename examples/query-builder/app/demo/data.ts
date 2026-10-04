import type { FieldSchema } from 'ember-search-ui-driver';

export interface Inspection {
  id: number;
  title: string;
  description: string;
  state: 'created' | 'pending' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  project: string;
  created_by_id: number;
  tags: string[];
  cost?: number;
  created_at: string;
  due_at: string | null;
}

const STATES = [
  'created',
  'pending',
  'in_progress',
  'done',
  'cancelled',
] as const;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const PROJECTS = ['Monterrey plant', 'Saltillo warehouse', 'Querétaro offices'];
const USERS = ['Ana Ruiz', 'Bruno Díaz', 'Carla Méndez', 'Diego Torres'];
const AREAS = [
  'Boiler room',
  'Loading dock',
  'Rooftop',
  'Server room',
  'Parking lot',
  'Kitchen',
];
const CHECKS = [
  'fire extinguishers',
  'emergency lights',
  'electrical panels',
  'safety harnesses',
  'gas lines',
  'first aid kits',
];
const TAGS = ['safety', 'electrical', 'fire', 'environment', 'quality'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 36 inspections; every field is a pure function of the index. */
export const INSPECTIONS: Inspection[] = Array.from({ length: 36 }, (_, i) => {
  const n = i + 1;
  const month = (i % 9) + 1; // Jan..Sep 2026
  const day = ((i * 7) % 27) + 1;
  const tags = TAGS.filter((_, t) => (i + t) % 3 === 0);
  return {
    id: n,
    title: `${AREAS[i % AREAS.length]} — ${CHECKS[(i * 5) % CHECKS.length]}`,
    description: `Check ${CHECKS[(i * 5) % CHECKS.length]} in the ${AREAS[i % AREAS.length]!.toLowerCase()}${i % 4 === 0 ? '; leak reported' : ''}.`,
    state: STATES[i % STATES.length]!,
    priority: PRIORITIES[(i * 2) % PRIORITIES.length]!,
    project: PROJECTS[i % PROJECTS.length]!,
    created_by_id: (i % USERS.length) + 1,
    tags,
    ...(i % 5 === 3 ? {} : { cost: ((i * 37) % 50) * 100 }),
    created_at: `2026-${pad(month)}-${pad(day)}T10:00:00Z`,
    due_at:
      i % 4 === 1 ? null : `2026-${pad(Math.min(month + 1, 12))}-${pad(day)}`,
  };
});

const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value.replace('_', ' ') }));

/** The filterable properties, as Prysmex describes its fields. */
export const FIELDS: FieldSchema = {
  title: { path: 'title', type: 'text', label: 'Title' },
  description: { path: 'description', type: 'text', label: 'Description' },
  state: {
    path: 'state',
    type: 'keyword',
    label: 'State',
    options: options(STATES),
  },
  priority: {
    path: 'priority',
    type: 'keyword',
    label: 'Priority',
    options: options(PRIORITIES),
  },
  project: {
    path: 'project',
    type: 'keyword',
    label: 'Project',
    options: options(PROJECTS),
  },
  created_by_id: {
    path: 'created_by_id',
    type: 'keyword',
    label: 'Created by',
    options: USERS.map((label, i) => ({ value: i + 1, label })),
  },
  tags: {
    path: 'tags',
    type: 'keyword',
    label: 'Tags',
    options: options(TAGS),
  },
  cost: { path: 'cost', type: 'number', label: 'Cost' },
  created_at: { path: 'created_at', type: 'date', label: 'Created' },
  due_at: { path: 'due_at', type: 'date', label: 'Due' },
};

export const userName = (id: number) => USERS[id - 1] ?? String(id);
