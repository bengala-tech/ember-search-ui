import { helper } from '@ember/component/helper';
import { getFilterValueDisplay } from './get-filter-value-display';

const toSelectBoxOption = (opt) => ({
	value: opt.value,
	label: getFilterValueDisplay(opt.value),
	count: opt.count,
});

export default helper(function ([opts] /*, hash*/) {
	let selectedSelectBoxOption;
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
		selectedSelectBoxOption
	}
});
