/* eslint-disable ember/no-at-ember-render-modifiers -- items register on insert, as in ember-headlessui */
import Component from '@glimmer/component';
import { hash } from '@ember/helper';
import { on } from '@ember/modifier';
import type Owner from '@ember/owner';
import type { WithBoundArgs } from '@glint/template';
import MenuItem from '../../-private/menu-item.gts';
import didInsert from '@ember/render-modifiers/modifiers/did-insert';

export interface AutocompleteInputItemsSignature {
  Element: HTMLDivElement;
  Args: {
    guid: string;
    buttonGuid: string;
    isOpen: boolean;
    closeMenu: (focusInput?: boolean) => void;
    activeItem: MenuItem | undefined;
    registerItem: (item: MenuItem) => void;
    unregisterItem: (item: MenuItem) => void;
    goToFirstItem: () => void;
    goToLastItem: () => void;
    goToNextItem: () => void;
    goToPreviousItem: () => void;
    goToItem: (item: MenuItem) => void;
  };
  Blocks: {
    default: [
      {
        Item: WithBoundArgs<
          typeof MenuItem,
          'registerItem' | 'unregisterItem' | 'goToItem' | 'closeMenu'
        >;
      },
    ];
  };
}

export default class AutocompleteInputItems extends Component<AutocompleteInputItemsSignature> {
  list: Element | null = null;

  constructor(owner: Owner, args: AutocompleteInputItemsSignature['Args']) {
    super(owner, args);
    window.addEventListener('click', this.maybeClose);
    window.addEventListener('keydown', this.maybeClose);
  }

  registerList = (element: Element) => {
    this.list = element;
  };

  maybeClose = (e: Event) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Escape') {
      this.args.closeMenu();
    }
    if (!key) {
      if (!this.list?.contains(e.target as Node)) {
        this.args.closeMenu();
      }
    }
  };

  willDestroy() {
    super.willDestroy();
    window.removeEventListener('click', this.maybeClose);
    window.removeEventListener('keydown', this.maybeClose);
    this.list = null;
  }

  onKeydown = (event: KeyboardEvent) => {
    event.preventDefault(); //prevents browser scrolling
    switch (event.key) {
      // Ref: https://www.w3.org/TR/wai-aria-practices-1.2/#keyboard-interaction-12
      case 'Enter':
        if (this.args.activeItem) {
          this.args.activeItem.element?.click();
        }
        this.args.closeMenu();
        break;
      case 'ArrowDown':
        return this.args.goToNextItem();
      case 'ArrowUp':
        return this.args.goToPreviousItem();
    }
  };

  <template>
    {{#if @isOpen}}
      {{! template-lint-disable no-invalid-interactive }}
      <div
        id={{@guid}}
        aria-labelledby={{@buttonGuid}}
        {{on "keydown" this.onKeydown}}
        tabindex="-1"
        {{didInsert this.registerList}}
        ...attributes
      >
        {{yield
          (hash
            Item=(component
              MenuItem
              registerItem=@registerItem
              unregisterItem=@unregisterItem
              goToItem=@goToItem
              closeMenu=@closeMenu
            )
          )
        }}
      </div>
    {{/if}}
  </template>
}
