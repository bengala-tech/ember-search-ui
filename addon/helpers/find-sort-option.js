import { helper } from "@ember/component/helper";

export function findSortOption(sortOptions, sortString) {
  const [value, direction] = sortString.split("|||");
  return sortOptions.find(
    option => option.value === value && option.direction === direction
  );
}

export default helper(function ([sortOptions, sortString] /*, hash*/) {
  return findSortOption(sortOptions, sortString);
});
