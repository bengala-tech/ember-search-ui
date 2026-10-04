/* eslint-disable ember/no-at-ember-render-modifiers -- items register on insert, as in ember-headlessui */
import type { TOC } from '@ember/component/template-only';
import { on } from '@ember/modifier';
import element from 'ember-element-helper/helpers/element';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';
import willDestroy from '@ember/render-modifiers/modifiers/will-destroy';

// Ported from ember-headlessui's `menu/item-element`.
export interface MenuItemElementSignature {
  Element: Element;
  Args: {
    guid: string;
    tagName?: string;
    isDisabled?: boolean;
    onMouseOver: () => void;
    onClick: (event: Event) => unknown;
    registerItemElement: (element: Element) => void;
    unregisterItemElement: () => void;
  };
  Blocks: { default: [] };
}

const MenuItemElement: TOC<MenuItemElementSignature> = <template>
  {{#let (element (if @tagName @tagName "a")) as |Tag|}}
    <Tag
      id={{@guid}}
      role="menuitem"
      tabindex="-1"
      disabled={{@isDisabled}}
      data-disabled={{@isDisabled}}
      ...attributes
      {{didInsert @registerItemElement}}
      {{on "mouseover" @onMouseOver}}
      {{on "click" @onClick}}
      {{willDestroy @unregisterItemElement}}
    >
      {{yield}}
    </Tag>
  {{/let}}
</template>;

export default MenuItemElement;
