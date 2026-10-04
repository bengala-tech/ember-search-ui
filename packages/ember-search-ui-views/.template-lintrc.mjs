export default {
  extends: 'recommended',
  checkHbsTemplateLiterals: false,
  overrides: [
    {
      // The views reproduce @elastic/react-search-ui-views' markup (and were
      // ported verbatim from the classic addon). These rules would require
      // changing that DOM, which is a separate, user-visible change.
      // TODO: revisit the a11y ones (labels, links, aria) deliberately.
      files: ['src/components/**/*'],
      rules: {
        'link-href-attributes': false,
        'no-inline-styles': false,
        'no-invalid-link-text': false,
        'no-nested-splattributes': false,
        'no-pointer-down-event-binding': false,
        // snippets and escaped field values are rendered as HTML on purpose
        'no-triple-curlies': false,
        'no-unsupported-role-attributes': false,
        'require-input-label': false,
      },
    },
  ],
};
