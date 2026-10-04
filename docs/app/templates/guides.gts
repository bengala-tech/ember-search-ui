import { pageTitle } from 'ember-page-title';
import { DocfyLink, DocfyOutput, DocfyPreviousAndNextPage } from '@docfy/ember';

// the parts of Docfy's page metadata this layout reads
interface Heading {
  id: string;
  title: string;
  depth: number;
  headings?: Heading[];
}
interface PageMetadata {
  url: string;
  title: string;
  headings: Heading[];
  frontmatter: Record<string, unknown>;
}
interface NestedPageMetadata {
  pages: PageMetadata[];
}

// The guides layout: navigation from Docfy's page list, the page, and
// previous / next links. Pages are sorted by their `order` front matter.

const orderOf = (page: PageMetadata) => Number(page.frontmatter['order'] ?? 99);
const pagesOf = (output: unknown) =>
  [...((output as NestedPageMetadata | undefined)?.pages ?? [])].sort(
    (a, b) => orderOf(a) - orderOf(b),
  );
const headingsOf = (output: unknown) =>
  ((output as PageMetadata | undefined)?.headings ?? []).flatMap((h) => [
    h,
    ...(h.headings ?? []),
  ]);
const hasHeadings = (output: unknown) => headingsOf(output).length > 0;
const indent = (depth: number) => (depth === 3 ? 'toc-sub' : '');

<template>
  {{pageTitle "Guides"}}
  <div class="docs-layout">
    <nav class="docs-nav" aria-label="Guides">
      <h2>Guides</h2>
      <DocfyOutput @scope="guides" as |output|>
        <ol>
          {{#each (pagesOf output) as |page|}}
            <li><DocfyLink
                @to={{page.url}}
                @activeClass="active"
              >{{page.title}}</DocfyLink></li>
          {{/each}}
        </ol>
      </DocfyOutput>
    </nav>
    <article class="docs-article prose">
      {{outlet}}
      <DocfyPreviousAndNextPage @scope="guides" as |previous next|>
        <footer class="docs-pager">
          {{#if previous}}
            <DocfyLink @to={{previous.url}} class="docs-prev">←
              {{previous.title}}</DocfyLink>
          {{/if}}
          {{#if next}}
            <DocfyLink @to={{next.url}} class="docs-next">{{next.title}}
              →</DocfyLink>
          {{/if}}
        </footer>
      </DocfyPreviousAndNextPage>
    </article>
    <DocfyOutput @fromCurrentURL={{true}} as |page|>
      {{#if (hasHeadings page)}}
        <aside class="docs-toc" aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {{#each (headingsOf page) as |heading|}}
              <li class={{indent heading.depth}}><a
                  href="#{{heading.id}}"
                >{{heading.title}}</a></li>
            {{/each}}
          </ul>
        </aside>
      {{/if}}
    </DocfyOutput>
  </div>
</template>
