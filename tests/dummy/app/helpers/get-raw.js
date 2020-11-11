import { helper } from '@ember/component/helper';
import { get } from '@ember/object';

export function getRaw(result, value) {
  return result?.value?.raw || get(result, value)
}

export default helper(function ([result, value] /*, hash*/) {
  return getRaw(result, value);
});
