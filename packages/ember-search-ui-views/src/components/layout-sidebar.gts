import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import '../styles/ember-search-ui-views.css';

export interface LayoutSidebarSignature {
  Element: HTMLDivElement;
  Blocks: { default: [] };
}

export default class LayoutSidebar extends Component<LayoutSidebarSignature> {
  @tracked isSidebarToggled = false;

  toggle = () => {
    this.isSidebarToggled = !this.isSidebarToggled;
  };

  <template>
    {{#if (has-block)}}
      <button
        hidden
        type="button"
        class="sui-layout-sidebar-toggle"
        {{on "click" this.toggle}}
      >
        Show Filters
      </button>
    {{/if}}
    <div
      class="sui-layout-sidebar sui-layout-sidebar--{{if
          this.isSidebarToggled
          'toggled'
        }}"
      ...attributes
    >
      {{#if (has-block)}}
        <button
          hidden
          type="button"
          class="sui-layout-sidebar-toggle"
          {{on "click" this.toggle}}
        >
          Save Filters
        </button>
      {{/if}}
      {{yield}}
    </div>
  </template>
}
