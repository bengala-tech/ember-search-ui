import { helper } from '@ember/component/helper';

export default helper(function ([opts] /*, hash*/) {
  return opts?.map(opt => ({label: opt, value: opt}))
});
