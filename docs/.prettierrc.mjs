export default {
  plugins: ['prettier-plugin-ember-template-tag'],
  overrides: [
    {
      files: '*.{js,gjs,ts,gts,mjs,mts,cjs,cts,md}',
      options: {
        singleQuote: true,
        templateSingleQuote: false,
      },
    },
  ],
};
