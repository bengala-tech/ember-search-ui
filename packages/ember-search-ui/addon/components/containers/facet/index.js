import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class FacetContainerComponent extends GlimmerComponent {
  @tracked more = this.args.show;
  @tracked searchTerm = '';

  @action
  removeFilter(removeFilter, value, field, filterType) {
    removeFilter(field, value, filterType);
  }

  @action
  onChange(setFilter, value, field, filterType) {
    setFilter(field, value, filterType);
  }

  @action
  onSelect(addFilter, value, field, filterType) {
    addFilter(field, value, filterType);
  }

  @action
  handleClickMore(a11yNotify, opts) {
    let visibleOptionsCount = more + 10;
    const showingAll = visibleOptionsCount >= totalOptions;
    if (showingAll) visibleOptionsCount = totalOptions;

    a11yNotify('moreFilters', { visibleOptionsCount, showingAll });
    this.more = visibleOptionsCount;
	}
}
