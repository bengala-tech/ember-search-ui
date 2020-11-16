import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class Items extends Component {
  list = null;

  constructor() {
    super(...arguments);
    window.addEventListener('click', this.maybeClose);
    window.addEventListener('keydown', this.maybeClose);
  }

  @action
  registerList(e) {
    this.list = e;
  }

  @action
  maybeClose(e) {
    if(e.key === 'Escape') {
      this.args.closeMenu();
    }
    if(!e.key) {
      if (!this.list?.contains(e.target)) {
        this.args.closeMenu();
      }
    }
  }

  willDestroy() {
    super.willDestroy(...arguments);
    window.removeEventListener('click', this.maybeClose);
    this.list = null;
  }

  @action
  onKeydown(event) {
    event.preventDefault(); //prevents browser scrolling
    switch (event.key) {
      // Ref: https://www.w3.org/TR/wai-aria-practices-1.2/#keyboard-interaction-12
      case 'Enter':
        if (this.args.activeItem) {
          this.args.activeItem.element.click();
        }
        this.args.closeMenu();
        break;
      case 'ArrowDown':
        return this.args.goToNextItem();
      case 'ArrowUp':
        return this.args.goToPreviousItem();
    }
  }
}
