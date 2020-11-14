import { helper } from '@ember/component/helper';
import { get } from '@ember/object';

const getPath = (path, value) => get(value, path);

export default helper(function ([path] /*, hash*/) {
  return getPath.bind(this, path);
});
