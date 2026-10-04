import Menu from 'ember-headlessui/components/menu';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { next } from '@ember/runloop';

export default class MenuComponent extends Menu {
  @tracked isOpen = true;
  @action
  open() {
    this.isOpen = true;
  }

  @action
  onInputEnter() {
    this.args.onInput(this.args.searchText);
  }

  @action
  close(focusInput = true) {
    this.isOpen = false;
    if (focusInput) {
      next(() => {
        document.getElementById(this.buttonGuid).focus();
      });
    }
  }

  @action
  goToPreviousItem() {
    let previousItem = this.items
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
    this._setActiveItem(previousItem);

    if (previousItem === undefined) {
      next(() => {
        document.getElementById(this.buttonGuid).focus();
      });
    }
  }

  @action
  _onInput() {}

  @action
  onPointerDown(event) {}
}
