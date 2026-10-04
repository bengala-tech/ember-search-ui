import type { SearchResult } from '@elastic/search-ui';
import { getFieldType } from './get-field-type.ts';

const VALID_PROTOCOLS = ['http:', 'https:'];

/**
 * @param URLParser URL interface provided by browser https://developer.mozilla.org/en-US/docs/Web/API/URL
 * @param currentLocation String representation of the browser's current location
 */
export function getUrlSanitizer(
  URLParser: typeof URL,
  currentLocation: string | URL | Location | undefined,
) {
  // This function is curried so that dependencies can be injected and don't need to be mocked in tests.
  return (url: unknown): string => {
    let parsedUrl: Partial<URL> = {};

    try {
      // Attempts to parse a URL as relative
      parsedUrl = new URLParser(url as string, currentLocation as string);
    } catch {
      // not a url
    }

    return VALID_PROTOCOLS.includes(parsedUrl.protocol!) ? (url as string) : '';
  };
}

export default function sanitizeResultUrl(
  result: SearchResult,
  urlField: string | undefined,
): string {
  return getUrlSanitizer(URL, location)(getFieldType(result, urlField, 'raw'));
}
