import { helper } from '@ember/component/helper';

export function getSnippet(result, value) {
  if (!result[value] || !result[value].snippet) return;
  return result[value].snippet;
}

export default helper(function ([result, value] /*, hash*/) {
  return getSnippet(result, value);
});
