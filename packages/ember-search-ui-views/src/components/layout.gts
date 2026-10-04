import type { TOC } from '@ember/component/template-only';
import LayoutSidebar from './layout-sidebar.gts';
import '../styles/ember-search-ui-views.css';

const Layout: TOC<{
  Element: HTMLDivElement;
  Blocks: {
    default: [];
    header: [];
    sideContent: [];
    bodyHeader: [];
    bodyContent: [];
    bodyFooter: [];
  };
}> = <template>
  <div class="sui-layout" ...attributes>
    <div class="sui-layout-header">
      <div class="sui-layout-header__inner">
        {{yield to="header"}}
      </div>
    </div>
    <div class="sui-layout-body">
      <div class="sui-layout-body__inner">
        <LayoutSidebar class="sui-layout-sidebar">
          {{yield to="sideContent"}}
        </LayoutSidebar>
        <div class="sui-layout-main">
          <div class="sui-layout-main-header">
            <div class="sui-layout-main-header__inner">
              {{yield to="bodyHeader"}}
            </div>
          </div>
          <div class="sui-layout-main-body">
            {{#if (has-block)}}
              {{yield}}
            {{else}}
              {{yield to="bodyContent"}}
            {{/if}}
          </div>
          <div class="sui-layout-main-footer">
            {{yield to="bodyFooter"}}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>;

export default Layout;
