import type { SortingOption } from '../types.ts';

export function findSortOption<T extends Omit<SortingOption, 'name'>>(
  sortOptions: T[],
  sortString: string,
): T | undefined {
  const [value, direction] = sortString.split('|||');
  return sortOptions.find(
    (option) => option.value === value && option.direction === direction,
  );
}

export default findSortOption;
