import GlimmerComponent from "@glimmer/component";
import { action } from "@ember/object";

export default class SearchBoxComponent extends GlimmerComponent {

	@action
	onSearchTextChange(onChange, term, select, e) {
		onChange(term);
	}

	@action
	onSubmit(onChange, value, e) {
		e.preventDefault();
		onChange(value)
	}

}
