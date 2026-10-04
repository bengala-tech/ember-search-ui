import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import ts from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/', 'coverage/']),
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    extends: [...ts.configs.recommendedTypeChecked],
    rules: {
      // stubs that mirror another API keep its parameter names, prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module' },
  },
]);
