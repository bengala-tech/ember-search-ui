import type { ComponentLike } from '@glint/template';
import gettingStarted from './getting-started.md';
import driver from './driver.md';
import properties from './properties.md';
import filtering from './filtering.md';
import views from './views.md';
import backends from './backends.md';
import legacyProperties from './legacy-properties.md';
// one source: the guide shipped with the driver package
import migrating from '../../../packages/ember-search-ui-driver/docs/migrating-from-search-ui.md';
import QuickStart from '../demos/quick-start.gts';
import DriverTree from '../demos/driver-tree.gts';
import FilterBarDemo from '../demos/filter-bar.gts';
import QueryBuilderDemo from '../demos/query-builder.gts';
import KanbanDemo from '../demos/kanban.gts';

export interface Guide {
  slug: string;
  doc: typeof gettingStarted;
  /** Live demos placed by `<!-- demo:name -->` markers. */
  demos?: Record<string, ComponentLike>;
}

/** The guides, in reading order. */
export const GUIDES: Guide[] = [
  {
    slug: 'getting-started',
    doc: gettingStarted,
    demos: { 'quick-start': QuickStart },
  },
  { slug: 'driver', doc: driver, demos: { 'driver-tree': DriverTree } },
  {
    slug: 'properties',
    doc: properties,
    demos: { 'filter-bar': FilterBarDemo },
  },
  {
    slug: 'filtering',
    doc: filtering,
    demos: { 'filter-bar': FilterBarDemo, 'query-builder': QueryBuilderDemo },
  },
  { slug: 'views', doc: views, demos: { kanban: KanbanDemo } },
  { slug: 'backends', doc: backends },
  {
    slug: 'legacy-properties',
    doc: legacyProperties,
    demos: { 'filter-bar': FilterBarDemo },
  },
  { slug: 'migrating', doc: migrating },
];

export const findGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);

export function neighbours(guide: Guide) {
  const index = GUIDES.findIndex((g) => g.slug === guide.slug);
  return { previous: GUIDES[index - 1], next: GUIDES[index + 1] };
}
