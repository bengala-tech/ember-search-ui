import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { fileURLToPath } from 'node:url';
import docfy from '@docfy/ember-vite';

export default defineConfig({
  plugins: [
    classicEmberSupport(),
    ember(),
    docfy({ root: fileURLToPath(new URL('.', import.meta.url)) }),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
