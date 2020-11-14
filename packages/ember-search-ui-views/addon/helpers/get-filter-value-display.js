import { helper } from '@ember/component/helper';

export function getFilterValueDisplay(filterValue) {
  if (filterValue === undefined || filterValue === null) return "";
  if (filterValue.hasOwnProperty("name")) return filterValue.name;
  return String(filterValue);
}
export default helper(function ([filterValue] /*, hash*/) {
  return getFilterValueDisplay(filterValue)
});
