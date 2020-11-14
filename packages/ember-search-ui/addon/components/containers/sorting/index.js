import GlimmerComponent from '@glimmer/component';
import { action } from '@ember/object';
import { findSortOption } from '../../../helpers/find-sort-option';
import { formatSelectOption } from '../../../helpers/format-select-option';

export default class ContainersSortingComponent extends GlimmerComponent {
  @action
  setSort(setSort, sortOptions, e) {
		const sortString = e?.value || e;
    const sortOption = findSortOption(sortOptions, sortString);
    setSort(sortOption.value, sortOption.direction);
  }

  formatSelectOption(sortOption) {
    return formatSelectOption(sortOption);
  }
}
