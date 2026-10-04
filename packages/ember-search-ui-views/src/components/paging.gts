import Component from '@glimmer/component';
import { fn } from '@ember/helper';
import { on } from '@ember/modifier';
import type { SearchDriver } from '@elastic/search-ui';
import PagingContainer from 'ember-search-ui/components/containers/paging';
import { add, eq, gte, range } from '../-private/template-helpers.ts';
import '../styles/ember-search-ui-views.css';

type OnChange = (current: number) => void;

export interface PagingSignature {
  Args: { driver: SearchDriver };
}

export default class Paging extends Component<PagingSignature> {
  next = (onChange: OnChange, current: number, totalPages: number) => {
    if (current < totalPages) {
      onChange(current + 1);
    }
  };

  goTo = (onChange: OnChange, current: number, i: number) => {
    if (current !== i) {
      onChange(i);
    }
  };

  prev = (onChange: OnChange, current: number) => {
    if (current <= 1) {
      return;
    }
    onChange(current - 1);
  };

  <template>
    <PagingContainer @driver={{@driver}} as |state|>
      {{#let (if state.current state.current 1) as |current|}}
        {{! template-lint-disable no-invalid-interactive }}
        {{! @glint-ignore -- legacy attribute kept from the original markup }}
        <ul class="rc-pagination sui-paging" unselectable="unselectable">
          <li
            class="{{if (eq current 1) 'rc-pagination-disabled'}}
              rc-pagination-prev"
            title="Previous Page"
            aria-disabled={{if (eq current 1) "true"}}
            {{on "click" (fn this.prev state.onChange current)}}
          >
            <a class="rc-pagination-item-link"></a>
          </li>
          {{#each (range 0 state.totalPages) as |i|}}
            <li
              class="rc-pagination-item rc-pagination-item-{{i}}
                {{if (eq current (add i 1)) ' rc-pagination-item-active'}}"
              tabindex="0"
              {{on "click" (fn this.goTo state.onChange current (add i 1))}}
            >
              <a>{{add i 1}}</a>
            </li>
          {{/each}}
          <li
            title="Next Page"
            aria-disabled="false"
            class="{{if
                (gte current state.totalPages)
                'rc-pagination-disabled'
              }}
              rc-pagination-next"
            {{on
              "click"
              (fn this.next state.onChange current state.totalPages)
            }}
          >
            <a class="rc-pagination-item-link"></a>
          </li>
        </ul>
      {{/let}}
    </PagingContainer>
  </template>
}
