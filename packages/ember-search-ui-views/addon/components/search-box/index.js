import GlimmerComponent from "@glimmer/component";
import { action } from "@ember/object";

export default class SearchBoxComponent extends GlimmerComponent {

	@action
	onSearchTextChange(onChange, term, select, e) {
		onChange(term);
	}

}
