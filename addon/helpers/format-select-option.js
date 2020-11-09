import { helper } from "@ember/component/helper";
import { formatValue } from './format-value';

export function formatSelectOption(sortOption) {
  return {
    label: sortOption.name,
    value: formatValue(sortOption.value, sortOption.direction)
  };
}

export default helper(function ([sortOption] /*, hash*/) {
  return formatSelectOption(sortOption);
});
