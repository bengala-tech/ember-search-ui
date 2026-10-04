// Not named `toLocaleString` internally: template compilers mistake
// Object.prototype names for keywords/scope entries and crash, and bundlers
// reuse a function's own name for import bindings.
export function formatLocaleString(
  value: { toLocaleString(locale?: string): string } | null | undefined,
  locale?: string,
): string | undefined {
  return value?.toLocaleString(locale);
}

export { formatLocaleString as toLocaleString };
export default formatLocaleString;
