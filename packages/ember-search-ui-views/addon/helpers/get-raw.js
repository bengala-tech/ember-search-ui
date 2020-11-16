import { helper } from '@ember/component/helper';

export function getRaw(result, value) {
  if (!result[value] || !result[value].raw) return;
  return result[value].raw;
}

export default helper(function ([result, value] /*, hash*/) {
  return getRaw(result, value);
});
