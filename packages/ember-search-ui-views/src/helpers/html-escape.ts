export function htmlEscape(str: unknown): string {
  if (!str) return '';

  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- any value is accepted
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default htmlEscape;
