import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';

export default class PagingComponent extends GlimmerComponent {
  @action
  next(onChange, current, totalPages) {
    if (current < totalPages) {
      onChange(current + 1);
    }
	}
	
	@action
	goTo(onChange, current, i) {
		if(current !== i) {
			onChange(i)
		}
	}

  @action
  prev(onChange, current, _totalPages) {
    if (current <= 1) {
      return;
    }
    onChange(current - 1);
  }
}
