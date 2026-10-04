/* eslint-disable ember/no-runloop -- focus moves after render, as in ember-headlessui */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { hash } from '@ember/helper';
import { on } from '@ember/modifier';
import { guidFor } from '@ember/object/internals';
import { next } from '@ember/runloop';
import type { WithBoundArgs } from '@glint/template';
import Input from './autocomplete-input/input.gts';
import Items from './autocomplete-input/items.gts';
import type MenuItem from '../-private/menu-item.gts';

export interface AutocompleteInputSignature {
  Element: HTMLDivElement;
  Args: {
    classIfOpen?: string;
    value?: string;
    onInput?: (valueOrEvent: string | Event) => void;
    searchText?: string;
  };
  Blocks: {
    default: [
      {
        closeMenu: (focusInput?: boolean) => void;
        isOpen: boolean;
        Input: WithBoundArgs<
          typeof Input,
          | 'isOpen'
          | 'menuGuid'
          | 'itemsGuid'
          | 'closeMenu'
          | 'openMenu'
          | 'goToFirstItem'
          | 'goToLastItem'
          | 'goToNextItem'
          | 'goToPreviousItem'
        >;
        Items: WithBoundArgs<
          typeof Items,
          | 'guid'
          | 'buttonGuid'
          | 'isOpen'
          | 'closeMenu'
          | 'activeItem'
          | 'registerItem'
          | 'unregisterItem'
          | 'goToFirstItem'
          | 'goToLastItem'
          | 'goToNextItem'
          | 'goToPreviousItem'
          | 'goToItem'
        >;
      },
    ];
  };
}

/**
 * An always-open-by-default menu for the search box autocomplete. Based on
 * ember-headlessui's Menu, which it used to extend.
 */
export default class AutocompleteInput extends Component<AutocompleteInputSignature> {
  guid = `${guidFor(this)}-tailwindui-menu`;
  @tracked isOpen = true;
  @tracked items: MenuItem[] = [];
  @tracked activeItem?: MenuItem;

  get activeItemIndex() {
    return this.items.indexOf(this.activeItem!);
  }

  get itemsGuid() {
    return `${this.guid}-items`;
  }

  get itemsElement() {
    return document.getElementById(this.itemsGuid);
  }

  get buttonGuid() {
    return `${this.guid}-button`;
  }

  get buttonElement() {
    return document.getElementById(this.buttonGuid);
  }

  toggle = () => {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  };

  open = () => {
    this.isOpen = true;
  };

  onInputEnter = () => {
    this.args.onInput?.(this.args.searchText ?? '');
  };

  close = (focusInput: unknown = true) => {
    this.isOpen = false;
    if (focusInput) {
      next(() => {
        this.buttonElement?.focus();
      });
    }
  };

  goToFirstItem = () => {
    const firstItem = this.items.find((item) => item.isEnabled);
    this.setActiveItem(firstItem);
  };

  goToLastItem = () => {
    const lastItem = this.items
      .slice()
      .reverse()
      .find((item) => item.isEnabled);
    this.setActiveItem(lastItem);
  };

  goToPreviousItem = () => {
    const previousItem = this.items
      .slice()
      .reverse()
      .find((item, index) => {
        if (
          this.activeItemIndex !== -1 &&
          this.items.length - index - 1 >= this.activeItemIndex
        ) {
          return false;
        }
        return item.isEnabled;
      });
    this.setActiveItem(previousItem);

    if (previousItem === undefined) {
      next(() => {
        this.buttonElement?.focus();
      });
    }
  };

  goToNextItem = () => {
    const nextItem = this.items.find((item, index) => {
      if (index <= this.activeItemIndex) {
        return false;
      }
      return item.isEnabled;
    });
    this.setActiveItem(nextItem);
  };

  goToItem = (item: MenuItem) => {
    this.setActiveItem(item);
  };

  registerItem = (item: MenuItem) => {
    const { items } = this;

    items.push(item);
    this.items = items;
  };

  unregisterItem = (item: MenuItem) => {
    const { items } = this;

    const index = items.indexOf(item);
    items.splice(index, 1);
    this.items = items;
  };

  onPointerDown = () => {};

  private setActiveItem(item: MenuItem | undefined) {
    if (item) {
      this.activeItem = item;
      this.items.forEach((item) => item.deactivate());
      this.activeItem.activate();
      this.itemsElement?.focus();
    }
  }

  <template>
    <div
      id={{this.guid}}
      {{on "pointerdown" this.onPointerDown}}
      class={{if this.isOpen @classIfOpen}}
      ...attributes
    >
      {{yield
        (hash
          closeMenu=this.close
          isOpen=this.isOpen
          Input=(component
            Input
            isOpen=this.isOpen
            menuGuid=this.guid
            itemsGuid=this.itemsGuid
            value=@value
            onInput=@onInput
            closeMenu=this.close
            openMenu=this.open
            goToFirstItem=this.goToFirstItem
            goToLastItem=this.goToLastItem
            goToNextItem=this.goToNextItem
            goToPreviousItem=this.goToPreviousItem
          )
          Items=(component
            Items
            guid=this.itemsGuid
            buttonGuid=this.buttonGuid
            isOpen=this.isOpen
            closeMenu=this.close
            activeItem=this.activeItem
            registerItem=this.registerItem
            unregisterItem=this.unregisterItem
            goToFirstItem=this.goToFirstItem
            goToLastItem=this.goToLastItem
            goToNextItem=this.goToNextItem
            goToPreviousItem=this.goToPreviousItem
            goToItem=this.goToItem
          )
        )
      }}
    </div>
  </template>
}
