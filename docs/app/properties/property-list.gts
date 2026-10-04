import type { TOC } from '@ember/component/template-only';
import { toProperties, type AnyProperty } from 'ember-search-ui-driver';
import type { TrackedSearch } from 'ember-search-ui';
import { display, urlOf } from './display.ts';

interface Signature {
  Args: {
    search: TrackedSearch<unknown>;
    properties: readonly AnyProperty<never, unknown>[];
  };
}

const withRole = (
  properties: readonly AnyProperty<never, unknown>[],
  role: 'title' | 'meta',
) => toProperties(properties).filter((p) => p.views?.list?.role === role);

/** Cards: the `title` property as the heading, `meta` properties below. */
const PropertyList: TOC<Signature> = <template>
  <ul class="property-list" data-test-property-list>
    {{#each @search.results as |row|}}
      <li class="property-card" data-test-card>
        {{#each (withRole @properties "title") as |heading|}}
          {{#let (urlOf heading row) as |link|}}
            <h3>{{#if link}}<a href={{link.url}}>{{display
                    heading
                    row
                  }}</a>{{else}}{{display heading row}}{{/if}}</h3>
          {{/let}}
        {{/each}}
        <dl>
          {{#each (withRole @properties "meta") as |meta|}}
            <div><dt>{{meta.label}}</dt><dd>{{display meta row}}</dd></div>
          {{/each}}
        </dl>
      </li>
    {{else}}
      <li class="empty">No inspections match.</li>
    {{/each}}
  </ul>
</template>;

export default PropertyList;
