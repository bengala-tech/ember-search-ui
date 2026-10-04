/* eslint-disable ember/no-runloop -- focus moves after render, as in ember-headlessui */
import Component from '@glimmer/component';
import { concat } from '@ember/helper';
import { on } from '@ember/modifier';
import { next } from '@ember/runloop';

export interface AutocompleteInputInputSignature {
  Element: HTMLInputElement;
  Args: {
    isOpen: boolean;
    menuGuid: string;
    itemsGuid: string;
    value?: string;
    placeholder?: string;
    isFocused?: boolean;
    onInput: (valueOrEvent: string | Event) => void;
    closeMenu: (focusInput?: boolean) => void;
    openMenu: () => void;
    goToFirstItem: () => void;
    goToLastItem: () => void;
    goToNextItem: () => void;
    goToPreviousItem: () => void;
  };
}

export default class AutocompleteInputInput extends Component<AutocompleteInputInputSignature> {
  onKeydown = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'Escape':
        this.args.onInput('');
        this.args.closeMenu(false);
        break;
      case 'Enter':
        if (this.args.isOpen) {
          this.args.closeMenu();
        }
        break;
      case 'ArrowDown':
        event.preventDefault();

        this.args.openMenu();
        next(() => {
          this.args.goToFirstItem();
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.args.openMenu();

        next(() => {
          this.args.goToLastItem();
        });
        break;
      default:
        if (!this.args.isOpen) {
          this.args.openMenu();
        }
    }
  };

  closeMenu = () => this.args.closeMenu();

  <template>
    <div class="sui-search-box__wrapper">
      <input
        type="search"
        value={{@value}}
        autocomplete="off"
        placeholder={{if @placeholder @placeholder "Search"}}
        class={{concat "sui-search-box__text-input " (if @isFocused " focus ")}}
        id="{{@menuGuid}}-button"
        {{on "input" @onInput}}
        {{on "keydown" this.onKeydown}}
        ...attributes
      />
    </div>
    <input
      type="submit"
      class="button sui-search-box__submit"
      value="Search"
      {{on "click" this.closeMenu}}
    />
  </template>
}
