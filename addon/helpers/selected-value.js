import { helper } from "@ember/component/helper";

export function selectedOption(selectedValue, options = []) {
  return selectedValue
	? options.find(option => option.value === selectedValue)
	: null;
}

export default helper(function ([selectedValue, options = []] /*, hash*/) {
  return selectedOption(selectedValue, options);
});
