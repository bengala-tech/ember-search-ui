import { readFile } from 'node:fs/promises';
import MarkdownIt from 'markdown-it';

// Guides are Markdown files imported by the app:
//
//   import guide from './guides/properties.md';
//   guide.title  guide.html  guide.toc
//
// They are rendered here, at build time, so the site ships HTML and no
// Markdown parser. Headings get ids (for links and the table of contents).
// `<!-- demo:name -->` comments mark where a page renders a live demo.

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: false, typographer: false });
  md.core.ruler.push('heading_ids', (state) => {
    const used = new Map();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type !== 'heading_open') continue;
      const text = tokens[i + 1]?.content ?? '';
      let id = slug(text) || 'section';
      const count = used.get(id) ?? 0;
      used.set(id, count + 1);
      if (count) id = `${id}-${count}`;
      token.attrSet('id', id);
    }
  });
  return md;
}

/** Renders a guide: its title (the first h1), HTML and h2/h3 outline. */
export function renderGuide(source, md = createRenderer()) {
  const env = {};
  const tokens = md.parse(source, env);
  let title = '';
  const toc = [];
  tokens.forEach((token, i) => {
    if (token.type !== 'heading_open') return;
    const level = Number(token.tag.slice(1));
    const text = tokens[i + 1]?.content ?? '';
    if (level === 1 && !title) title = text;
    if (level === 2 || level === 3)
      toc.push({ id: token.attrGet('id'), text, level });
  });
  return { title, html: md.renderer.render(tokens, md.options, env), toc };
}

/** Vite plugin: `import guide from './x.md'`. */
export function markdown() {
  const md = createRenderer();
  return {
    name: 'docs-markdown',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.md')) return null;
      const source = await readFile(file, 'utf8');
      return `export default ${JSON.stringify(renderGuide(source, md))};`;
    },
  };
}
