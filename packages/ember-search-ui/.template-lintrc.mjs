export default {
  extends: 'recommended',
  checkHbsTemplateLiterals: false,
  overrides: [
    {
      // Test-only views render bare inputs to drive the containers.
      files: ['tests/**/*'],
      rules: {
        'require-input-label': false,
      },
    },
  ],
};
