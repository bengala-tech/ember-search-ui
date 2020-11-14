import { helper } from '@ember/component/helper';

export function htmlEscape(str) {
  if (!str) return "";

  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
export default helper(function ([str] /*, hash*/) {
  return htmlEscape(str)
});
