import GlimmerComponent from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class LayoutsLayoutSidebarComponent extends GlimmerComponent {
	@tracked isSidebarToggled = false;

	@action
	toggle() {
		this.isSidebarToggled = !this.isSidebarToggled;
	}
}