import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class FacetContainerComponent extends GlimmerComponent {
  @tracked more = this.args.show || 5;
  @tracked searchTerm = '';

  @action
  removeFilter(removeFilter, field, filterType, value) {
    removeFilter(field, value, filterType);
  }

  @action
  setFilter(setFilter, field, filterType, value) {
    setFilter(field, value, filterType);
  }

  @action
  addFilter(addFilter, field, filterType, value) {
    addFilter(field, value, filterType);
  }

  @action
  handleClickMore(a11yNotify, opts) {
    let visibleOptionsCount = this.more + 10;
    const showingAll = visibleOptionsCount >= opts;
    if (showingAll) visibleOptionsCount = opts;

    a11yNotify('moreFilters', { visibleOptionsCount, showingAll });
    this.more = visibleOptionsCount;
  }
  
  @action
  onSearch(e) {
    this.searchTerm = e.target.value;
  }
}
