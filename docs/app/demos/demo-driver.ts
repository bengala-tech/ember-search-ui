import { registerDestructor } from '@ember/destroyable';
import {
  SearchDriver,
  memoryBackend,
  type DriverOptions,
} from 'ember-search-ui-driver';
import { INSPECTIONS, type Inspection } from '../demo/data.ts';

/** A driver over the demo inspections, destroyed with `owner`. */
export function demoDriver(
  owner: object,
  options: Omit<DriverOptions<Inspection>, 'backend'> = {},
): SearchDriver<Inspection> {
  const driver = new SearchDriver<Inspection>({
    backend: memoryBackend(INSPECTIONS, {
      searchFields: ['title', 'description', 'project'],
    }),
    initialState: { page: { kind: 'offset', page: 1, perPage: 5 } },
    ...options,
  });
  registerDestructor(owner, () => driver.destroy());
  return driver;
}
