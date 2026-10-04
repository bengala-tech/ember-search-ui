export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // component-scoped selectors (.pager button, .results th button) do not compete
    'no-descending-specificity': null,
  },
};
