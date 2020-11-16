import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { next } from '@ember/runloop';

export default class InputComponent extends GlimmerComponent {
  @action
  onKeydown(event) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
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

        if (this.args.isOpen && event.key === 'Enter') {
          this.args.closeMenu();
        } else {
          this.args.openMenu();
          next(() => {
            this.args.goToFirstItem();
          });
        }
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
  }
}
