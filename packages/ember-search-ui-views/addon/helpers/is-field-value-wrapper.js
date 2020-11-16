import { helper } from '@ember/component/helper';

export function isFieldValueWrapper(object) {
  return (
    object && (object.hasOwnProperty("raw") || object.hasOwnProperty("snippet"))
  );
}
export default helper(function ([object] /*, hash*/) {
  return isFieldValueWrapper(object)
});
