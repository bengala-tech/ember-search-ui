import { formatValue } from './format-value.ts';
import type { SelectOption, SortingOption } from '../types.ts';

export function formatSelectOption(sortOption: SortingOption): SelectOption {
  return {
    label: sortOption.name,
    value: formatValue(sortOption.value, sortOption.direction),
  };
}

export default formatSelectOption;
