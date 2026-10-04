import type { FilterValue } from '@elastic/search-ui';

export function getFilterValueDisplay(
  filterValue: FilterValue | null | undefined,
): string {
  if (filterValue === undefined || filterValue === null) return '';
  if (Object.prototype.hasOwnProperty.call(filterValue, 'name'))
    return (filterValue as { name: string }).name;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- arrays/values display as strings
  return String(filterValue);
}

export default getFilterValueDisplay;
