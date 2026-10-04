import {
  defineProperty,
  extendProperty,
  type AnyProperty,
  type LegacyProperty,
  type Option,
} from 'ember-search-ui-driver';
import type { Inspection } from '../demo/data.ts';
import { userName } from '../demo/data.ts';
import LegacyStatePicker from './legacy-state-picker.gts';
import StateBadge from './state-badge.gts';

// One list of properties for the inspections. Every view on the page (the
// filter bar, the query builder, the table, the list, the calendar and the
// export) reads these; none of them knows the fields. Most use the
// Property shape; State and Tags use the legacy shape, unchanged.

// Each view declares the config it reads from a property.
declare module 'ember-search-ui-driver' {
  interface PropertyViews {
    table?: { hidden?: boolean; numeric?: boolean };
    list?: { role: 'title' | 'meta' };
    calendar?: { date: true };
  }
}

const options = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: value.replace('_', ' ') }));

// a builder: properties of one kind share it, overrides per field
const keyword = (path: string, label: string, values: readonly string[]) =>
  defineProperty<Inspection>({
    label,
    field: { path, type: 'keyword', options: options(values) },
    views: { list: { role: 'meta' } },
  });

const date = (path: string, label: string) =>
  defineProperty<Inspection>({
    label,
    field: { path, type: 'date' },
    value: (row) => {
      const value = row[path as keyof Inspection] as string | null;
      return value ? value.slice(0, 10) : null;
    },
  });

// --- the legacy shape: a class with getters, as legacy apps write them ------

class LegacyListProperty implements LegacyProperty {
  name = '';
  valuePath = '';
  private _filteredBy?: string;
  isFilterable = true;
  componentsForFiltering: LegacyProperty['componentsForFiltering'] = {};
  viewConfig: Record<string, unknown> = {};

  constructor(config: Partial<LegacyListProperty> & { filteredBy?: string }) {
    Object.assign(this, config);
  }
  get filteredBy(): string {
    return this._filteredBy || this.valuePath;
  }
  set filteredBy(value: string) {
    this._filteredBy = value;
  }
  get useFilter() {
    return this.filteredBy && this.isFilterable !== false;
  }
}

const STATES = ['created', 'pending', 'in_progress', 'done', 'cancelled'];

const state = new LegacyListProperty({
  name: 'State',
  valuePath: 'state',
  componentsForFiltering: {
    filter: {
      component: LegacyStatePicker,
      args: { choices: options(STATES) },
    },
    listValue: { component: StateBadge },
  },
  viewConfig: { list: { role: 'meta' } },
});

// a plain legacy object: no components, so the built-in editor is used
const tags: LegacyProperty = {
  name: 'Tags',
  valuePath: 'tags',
  viewConfig: { list: { role: 'meta' } },
};

// --- the Property shape ---------------------------------------------------------

const title = defineProperty<Inspection>({
  label: 'Title',
  field: { path: 'title', type: 'text' },
  link: (row) => ({ url: `#inspection-${row.id}` }),
  views: { list: { role: 'title' } },
});

const priority = keyword('priority', 'Priority', ['low', 'medium', 'high']);
const project = keyword('project', 'Project', [
  'Monterrey plant',
  'Saltillo warehouse',
  'Querétaro offices',
]);

const createdBy = extendProperty(keyword('created_by_id', 'Created by', []), {
  field: {
    options: [1, 2, 3, 4].map((id) => ({ value: id, label: userName(id) })),
  },
  value: (row) => userName(row.created_by_id),
  sort: false,
});

const cost = defineProperty<Inspection>({
  label: 'Cost',
  field: { path: 'cost', type: 'number' },
  views: { table: { numeric: true } },
  export: { value: (row) => row.cost ?? '' },
});

const createdAt = extendProperty(date('created_at', 'Created'), {
  views: { calendar: { date: true } },
});
const dueAt = date('due_at', 'Due');

const id = defineProperty<Inspection>({
  label: 'Id',
  field: { path: 'id', type: 'number' },
  filter: false,
  views: { table: { hidden: true } },
});

export const PROPERTIES: readonly AnyProperty<Inspection, unknown>[] = [
  title,
  state,
  priority,
  project,
  createdBy,
  tags,
  cost,
  createdAt,
  dueAt,
  id,
];
