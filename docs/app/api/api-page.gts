import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { concat } from '@ember/helper';
import { DocfyLink } from '@docfy/ember';
import { API, type ApiPackage, type ApiSection } from './reference.ts';

const anchor = (name: string) => name.replace(/[^a-z0-9]+/gi, '-');

/** The API reference, with a quick filter. */
export default class ApiPage extends Component {
  @tracked term = '';

  get packages(): ApiPackage[] {
    const term = this.term.trim().toLowerCase();
    if (!term) return API;
    return API.map((pkg) => ({
      ...pkg,
      sections: pkg.sections
        .map((section): ApiSection => ({
          ...section,
          entries: section.entries.filter(
            (entry) =>
              entry.name.toLowerCase().includes(term) ||
              entry.summary.toLowerCase().includes(term),
          ),
        }))
        .filter((section) => section.entries.length > 0),
    })).filter((pkg) => pkg.sections.length > 0);
  }

  filter = (event: Event) => {
    this.term = (event.target as HTMLInputElement).value;
  };

  <template>
    <div class="api-page">
      <h1>API reference</h1>
      <p>
        Everything each package exports, in one place. The guides explain how
        the pieces fit; this page is for looking things up.
      </p>
      <input
        type="search"
        class="api-filter"
        placeholder="Filter by name or description"
        aria-label="Filter the API reference"
        data-test-api-filter
        {{on "input" this.filter}}
      />
      {{#each this.packages as |pkg|}}
        <section class="api-package" data-test-api-package={{pkg.name}}>
          <h2 id={{anchor pkg.name}}><code>{{pkg.name}}</code></h2>
          <p>{{pkg.summary}}</p>
          {{#each pkg.sections as |section|}}
            <h3>{{section.title}}</h3>
            <dl class="api-entries">
              {{#each section.entries as |entry|}}
                <div class="api-entry" data-test-api-entry={{entry.name}}>
                  <dt>
                    <code>{{entry.name}}</code>
                    <span
                      class="api-kind api-kind-{{entry.kind}}"
                    >{{entry.kind}}</span>
                  </dt>
                  <dd>
                    {{entry.summary}}
                    {{#if entry.guide}}
                      <DocfyLink
                        @to={{concat "/guides/" entry.guide}}
                      >Guide</DocfyLink>
                    {{/if}}
                  </dd>
                </div>
              {{/each}}
            </dl>
          {{/each}}
        </section>
      {{else}}
        <p class="hint">Nothing matches.</p>
      {{/each}}
    </div>
  </template>
}
