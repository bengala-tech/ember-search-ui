import type { FacetValue, FilterValue } from '@elastic/search-ui';
import { getFilterValueDisplay } from './get-filter-value-display.ts';

export interface SelectBoxOption {
  value: FilterValue;
  label: string;
  count: number;
}

const toSelectBoxOption = (opt: FacetValue): SelectBoxOption => ({
  value: opt.value,
  label: getFilterValueDisplay(opt.value),
  count: opt.count,
});

export function mapFacetOptions(opts: FacetValue[] | undefined) {
  let selectedSelectBoxOption: SelectBoxOption | undefined;
  let isSelectedSelectBoxOptionSet = false;
  const selectBoxOptions = opts?.map((opt) => {
    const selectBoxOption = toSelectBoxOption(opt);

    if (opt.selected && !isSelectedSelectBoxOptionSet) {
      selectedSelectBoxOption = selectBoxOption;
      isSelectedSelectBoxOptionSet = true;
    }
    return selectBoxOption;
  });

  return {
    options: selectBoxOptions,
    selectedSelectBoxOption,
  };
}

export default mapFacetOptions;
