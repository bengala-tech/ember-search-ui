import { helper } from "@ember/component/helper";

export function formatValue(sortField, sortDirection) {
  return `${sortField}|||${sortDirection}`;
}

export default helper(function ([sortField, sortDirection] /*, hash*/) {
  return formatValue(sortField, sortDirection);
});
