import { helper } from "@ember/component/helper";

export default helper(function ([exp] /*, hash*/) {
  return !!exp;
});
