import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class SearchBoxComponent extends GlimmerComponent {
	@tracked input = null;

	@action
	didInsertInput(ele) {
		this.input = ele;
	}

	@action
	open(dd, e) {
		if (e.keyCode === 32) {
			return false;
		}

		this.focusInput();

		if (!dd.isOpen) {
			dd.actions.open();
		}

		return;
	}

	@action
	focusInput() {
		this.input.focus();
	}
}