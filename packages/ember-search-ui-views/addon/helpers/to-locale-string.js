import { helper } from '@ember/component/helper';

export default helper(function ([str, locale] /*, hash*/) {
  return str?.toLocaleString(locale);
});
