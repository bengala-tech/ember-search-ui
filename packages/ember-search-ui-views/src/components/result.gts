import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import type { ResultViewSignature } from 'ember-search-ui';
import getEscapedFields from '../helpers/get-escaped-fields.ts';
import getEscapedField from '../helpers/get-escaped-field.ts';
import sanitizeResultUrl from '../helpers/get-url-sanitizer.ts';
import { and, not, optional } from '../-private/template-helpers.ts';
import '../styles/ember-search-ui-views.css';

const Result: TOC<{
  Element: HTMLLIElement;
  Args: Pick<ResultViewSignature['Args'], 'result'> &
    Partial<ResultViewSignature['Args']>;
}> = <template>
  {{#let
    (getEscapedFields @result)
    (getEscapedField @result @titleField)
    (sanitizeResultUrl @result @urlField)
    as |fields title url|
  }}
    <li class="sui-result" ...attributes>
      <div class="sui-result__header">
        {{#if (and title (not url))}}
          <span class="sui-result__title">
            {{{title}}}
          </span>
        {{/if}}
        {{#if (and title url)}}
          <a
            class="sui-result__title sui-result__title-link"
            href={{url}}
            target="_blank"
            rel="noopener noreferrer"
            {{on "click" (optional @onClickLink)}}
          >
            {{{title}}}
          </a>
        {{/if}}
      </div>
      <div class="sui-result__body">
        <ul class="sui-result__details">
          {{#each-in fields as |key value|}}
            <li>
              <span class="sui-result__key">
                {{key}}
              </span>
              <span class="sui-result__value">
                {{{value}}}
              </span>
            </li>
          {{/each-in}}
        </ul>
      </div>
    </li>
  {{/let}}
</template>;

export default Result;
