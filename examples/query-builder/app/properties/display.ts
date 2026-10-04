import {
  propertyValue,
  type AnyProperty,
  type UrlLink,
} from 'ember-search-ui-driver';

/** A property's value as text, for any view. */
export function display(
  property: AnyProperty<never, unknown>,
  row: unknown,
): string {
  const value = propertyValue(property as AnyProperty<unknown, unknown>, row);
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return JSON.stringify(value) ?? '—';
}

/** A URL link, if the property has one for this row. */
export function urlOf(
  property: AnyProperty<never, unknown>,
  row: unknown,
): UrlLink | undefined {
  const link = (property as { link?: (row: unknown) => unknown }).link?.(row);
  if (typeof link === 'string') return { url: link };
  return link && typeof link === 'object' && 'url' in link
    ? (link as UrlLink)
    : undefined;
}
