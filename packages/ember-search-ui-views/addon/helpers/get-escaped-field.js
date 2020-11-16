import { helper } from "@ember/component/helper";
import { getFieldType } from "./get-field-type";
import { htmlEscape } from "./html-escape";

export function getEscapedField(result, field) {
  const safeField =
    getFieldType(result, field, "snippet") ||
    htmlEscape(getFieldType(result, field, "raw")) ||
    htmlEscape(result[field]);
  return Array.isArray(safeField) ? safeField.join(", ") : safeField;
}

export default helper(function ([result, field] /*, hash*/) {
  return getEscapedField(result, field)
});
