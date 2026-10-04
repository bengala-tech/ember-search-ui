import path from 'node:path';
import { fileURLToPath } from 'node:url';
import docfyShiki from '@docfy/plugin-shiki';

const here = path.dirname(fileURLToPath(import.meta.url));

// Guides are Markdown pages compiled to Ember route templates by Docfy, so
// they can render components inline (see each page's `imports`).
export default {
  sources: [
    {
      root: path.join(here, 'guides'),
      pattern: '**/*.md',
      urlPrefix: 'guides',
    },
    {
      // one source: the migration guide shipped with the driver package
      root: path.join(here, '../packages/ember-search-ui-driver/docs'),
      pattern: 'migrating-from-search-ui.md',
      urlPrefix: 'guides',
    },
  ],
  rehypePlugins: [...docfyShiki()],
};
