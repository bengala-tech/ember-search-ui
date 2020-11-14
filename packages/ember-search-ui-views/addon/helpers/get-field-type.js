import { helper } from '@ember/component/helper';

export function getFieldType(result, field, type) {
  if (result[field]) return result[field][type];
}
export default helper(function ([result, field, type] /*, hash*/) {
  return getFieldType(result, field, type)
});
