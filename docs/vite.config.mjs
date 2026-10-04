import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { markdown } from './markdown.mjs';

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    markdown(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
