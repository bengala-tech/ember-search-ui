import { helper } from '@ember/component/helper';

export const accentFold = (str = '') =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');


export default helper(function (
  [facetValues = [], searchTerm = '']
) {
	if (searchTerm.trim()) {
		return facetValues.filter(option =>
			accentFold(option.value)
				.toLowerCase()
				.includes(accentFold(searchTerm).toLowerCase())
		);
	}
  return facetValues;
});
