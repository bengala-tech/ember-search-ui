import Component from '@glimmer/component';
import { on } from '@ember/modifier';
import { service } from '@ember/service';
import { htmlSafe } from '@ember/template';
import type RouterService from '@ember/routing/router-service';

interface Signature {
  Element: HTMLDivElement;
  Args: { html: string };
}

/**
 * Guide HTML (rendered at build time from the repo's own Markdown). Links to
 * other pages of the site navigate in the app instead of reloading it.
 */
export default class Prose extends Component<Signature> {
  @service declare router: RouterService;

  get content() {
    // trusted: built from Markdown files in this repository
    return htmlSafe(this.args.html);
  }

  navigate = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link = (event.target as Element).closest('a');
    const href = link?.getAttribute('href');
    if (!link || !href || link.target || !href.startsWith('/')) return;
    event.preventDefault();
    this.router.transitionTo(href);
  };

  <template>
    {{! template-lint-disable no-invalid-interactive }}
    <div class="prose" ...attributes {{on "click" this.navigate}}>
      {{this.content}}
    </div>
  </template>
}
