import type { TOC } from '@ember/component/template-only';
import { LinkTo } from '@ember/routing';
import Prose from './prose.gts';
import { GUIDES, neighbours, type Guide } from '../guides/index.ts';

/** Either HTML or the name of a demo (with empty HTML). */
interface Part {
  html: string;
  demo?: string;
}

/** The guide's HTML, split around its `<!-- demo:name -->` markers. */
function parts(guide: Guide): Part[] {
  const out: Part[] = [];
  const pattern = /<!--\s*demo:([\w-]+)\s*-->/g;
  let last = 0;
  for (const match of guide.doc.html.matchAll(pattern)) {
    out.push({ html: guide.doc.html.slice(last, match.index) });
    out.push({ html: '', demo: match[1]! });
    last = match.index + match[0].length;
  }
  out.push({ html: guide.doc.html.slice(last) });
  return out;
}

const demoOf = (guide: Guide, name: string) => guide.demos?.[name];
const previousOf = (guide: Guide) => neighbours(guide).previous;
const nextOf = (guide: Guide) => neighbours(guide).next;
const isCurrent = (a: Guide, b: Guide) => a.slug === b.slug;
const indent = (level: number) => (level === 3 ? 'toc-sub' : '');

/** A guide: navigation, the text with its live demos, and its outline. */
const GuidePage: TOC<{ Args: { guide: Guide } }> = <template>
  <div class="docs-layout">
    <nav class="docs-nav" aria-label="Guides">
      <h2>Guides</h2>
      <ol>
        {{#each GUIDES as |entry|}}
          <li>
            <LinkTo
              @route="guide"
              @model={{entry.slug}}
              class={{if (isCurrent entry @guide) "active"}}
            >{{entry.doc.title}}</LinkTo>
          </li>
        {{/each}}
      </ol>
    </nav>
    <article class="docs-article" data-test-guide={{@guide.slug}}>
      {{#each (parts @guide) as |part|}}
        {{#if part.demo}}
          {{#let (demoOf @guide part.demo) as |Demo|}}
            {{#if Demo}}
              <section
                class="demo"
                aria-label="Live demo"
                data-test-demo={{part.demo}}
              >
                <Demo />
              </section>
            {{/if}}
          {{/let}}
        {{else}}
          <Prose @html={{part.html}} />
        {{/if}}
      {{/each}}
      <footer class="docs-pager">
        {{#let (previousOf @guide) as |previous|}}
          {{#if previous}}
            <LinkTo @route="guide" @model={{previous.slug}} class="docs-prev">←
              {{previous.doc.title}}</LinkTo>
          {{/if}}
        {{/let}}
        {{#let (nextOf @guide) as |next|}}
          {{#if next}}
            <LinkTo
              @route="guide"
              @model={{next.slug}}
              class="docs-next"
            >{{next.doc.title}}
              →</LinkTo>
          {{/if}}
        {{/let}}
      </footer>
    </article>
    {{#if @guide.doc.toc.length}}
      <aside class="docs-toc" aria-label="On this page">
        <h2>On this page</h2>
        <ul>
          {{#each @guide.doc.toc as |entry|}}
            <li class={{indent entry.level}}><a
                href="#{{entry.id}}"
              >{{entry.text}}</a></li>
          {{/each}}
        </ul>
      </aside>
    {{/if}}
  </div>
</template>;

export default GuidePage;
