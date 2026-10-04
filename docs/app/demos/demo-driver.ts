import { registerDestructor } from '@ember/destroyable';
import {
  SearchDriver,
  memoryBackend,
  type DriverOptions,
} from 'ember-search-ui-driver';
import { INSPECTIONS, type Inspection } from '../demo/data.ts';
import { share } from '../demo/share.ts';

/**
 * A driver over the demo inspections, destroyed with `owner`. Its search
 * is kept in the URL under `prefix`, so it can be shared as a link.
 */
export function demoDriver(
  owner: object,
  prefix: string,
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
  share(owner, driver, prefix);
  return driver;
}
