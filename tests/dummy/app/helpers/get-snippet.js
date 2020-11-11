import { helper } from '@ember/component/helper';
import { get } from '@ember/object';

export function getSnippet(result, value) {
  return result?.value?.snippet || get(result, value)
}

export default helper(function ([result, value] /*, hash*/) {
  return getSnippet(result, value);
});
