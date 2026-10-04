import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { hash } from '@ember/helper';
import { guidFor } from '@ember/object/internals';
import type { WithBoundArgs } from '@glint/template';
import MenuItemElement from './menu-item-element.gts';

// Ported from ember-headlessui's `menu/item`.
export interface MenuItemSignature {
  Args: {
    isDisabled?: boolean;
    registerItem: (item: MenuItem) => void;
    unregisterItem: (item: MenuItem) => void;
    goToItem: (item: MenuItem) => void;
    closeMenu: () => void;
  };
  Blocks: {
    default: [
      {
        isActive: boolean;
        isDisabled: boolean;
        Element: WithBoundArgs<
          typeof MenuItemElement,
          | 'guid'
          | 'isDisabled'
          | 'onMouseOver'
          | 'registerItemElement'
          | 'unregisterItemElement'
          | 'onClick'
        >;
      },
    ];
  };
}

export default class MenuItem extends Component<MenuItemSignature> {
  guid = `${guidFor(this)}-tailwindui-menu-item`;
  element: HTMLElement | null = null;
  @tracked isActive = false;

  get isDisabled() {
    return Boolean(this.args.isDisabled);
  }

  get isEnabled() {
    return !this.isDisabled;
  }

  focus = () => {
    this.element?.focus();
  };

  activate = () => {
    this.focus();
    this.isActive = true;
  };

  deactivate = () => {
    this.isActive = false;
  };

  registerItemElement = (element: Element) => {
    this.element = element as HTMLElement;
    this.args.registerItem(this);
  };

  unregisterItemElement = () => {
    this.element = null;
    this.args.unregisterItem(this);
  };

  onElementClick = (event: Event) => {
    if (this.isDisabled) return event.preventDefault();
    this.args.closeMenu();
  };

  onMouseOver = () => {
    if (this.args.isDisabled) return;
    if (this.isActive) return;

    this.args.goToItem(this);
  };

  <template>
    {{yield
      (hash
        isActive=this.isActive
        isDisabled=this.isDisabled
        Element=(component
          MenuItemElement
          guid=this.guid
          isDisabled=@isDisabled
          onMouseOver=this.onMouseOver
          registerItemElement=this.registerItemElement
          unregisterItemElement=this.unregisterItemElement
          onClick=this.onElementClick
        )
      )
    }}
  </template>
}
