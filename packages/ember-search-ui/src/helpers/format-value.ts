export function formatValue(sortField: string, sortDirection: string): string {
  return `${sortField}|||${sortDirection}`;
}

export default formatValue;
