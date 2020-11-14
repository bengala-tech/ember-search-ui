import { helper } from '@ember/component/helper';

export function countAutocompletedSuggestions(autocompletedSuggestions) {
  return Object.entries(autocompletedSuggestions).reduce(
    (acc, [_, value]) => acc + value.length,
    0
  );
}

export default helper(function ([autocompletedSuggestions] /*, hash*/) {
  return countAutocompletedSuggestions(autocompletedSuggestions);
});
