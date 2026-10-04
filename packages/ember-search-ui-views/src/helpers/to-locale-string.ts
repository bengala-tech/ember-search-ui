export function toLocaleString(
  value: { toLocaleString(locale?: string): string } | null | undefined,
  locale?: string,
): string | undefined {
  return value?.toLocaleString(locale);
}

export default toLocaleString;
