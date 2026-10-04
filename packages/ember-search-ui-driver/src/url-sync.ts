import { urlCodec, type UrlCodec, type UrlCodecOptions } from './codecs/url.ts';
import type { SearchDriver } from './driver.ts';
import type { SearchState } from './types.ts';

/**
 * How URL sync reads and writes the query string. The default uses
 * `window.history`; a framework router can provide its own.
 */
export interface UrlAdapter {
  /** The current query string, with or without "?". */
  read(): string;
  /** Replaces the query string (keep path and hash). */
  write(search: string, mode: 'push' | 'replace'): void;
  /** Calls `onChange` when the URL changes outside the sync (back/forward). */
  listen(onChange: () => void): () => void;
}

export interface UrlSyncOptions extends UrlCodecOptions {
  adapter?: UrlAdapter;
  /** A codec to use instead of building one from the options above. */
  codec?: UrlCodec;
  /** New history entry per change (`push`, default) or rewrite it (`replace`). */
  history?: 'push' | 'replace';
  /** Wait this long after the last change before writing. Default 300. */
  debounceMs?: number;
  /** Apply the URL to the driver when sync starts. Default true. */
  restore?: boolean;
}

/** `window.history` and `popstate`. */
export function browserHistory(win: Window = window): UrlAdapter {
  return {
    read: () => win.location.search,
    write(search, mode) {
      const url = `${win.location.pathname}${search ? `?${search}` : ''}${win.location.hash}`;
      if (mode === 'push') win.history.pushState(win.history.state, '', url);
      else win.history.replaceState(win.history.state, '', url);
    },
    listen(onChange) {
      win.addEventListener('popstate', onChange);
      return () => win.removeEventListener('popstate', onChange);
    },
  };
}

/** An in-memory URL with a back/forward stack, for tests and non-browser use. */
export function memoryHistory(initial = ''): UrlAdapter & {
  readonly entries: readonly string[];
  back(): void;
  forward(): void;
} {
  const entries = [strip(initial)];
  let index = 0;
  const listeners = new Set<() => void>();
  const go = (to: number) => {
    if (to < 0 || to >= entries.length) return;
    index = to;
    listeners.forEach((l) => l());
  };
  return {
    get entries() {
      return entries.slice(0, index + 1);
    },
    read: () => entries[index] ?? '',
    write(search, mode) {
      if (mode === 'push') {
        entries.splice(index + 1, entries.length, strip(search));
        index++;
      } else {
        entries[index] = strip(search);
      }
    },
    listen(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    back: () => go(index - 1),
    forward: () => go(index + 1),
  };
}

/**
 * Keeps the driver's state in the URL: restores it on start, writes changes
 * (debounced), and follows back/forward. Other query parameters are left
 * alone. Hooks into the driver only through `subscribe`. Returns `stop`.
 */
export function syncUrl<Doc>(
  driver: SearchDriver<Doc>,
  options: UrlSyncOptions = {},
): () => void {
  const adapter = options.adapter ?? browserHistory();
  const codec =
    options.codec ?? urlCodec({ defaults: driver.state, ...options });
  const mode = options.history ?? 'push';
  const debounceMs = options.debounceMs ?? 300;

  let lastWritten = codec.serialize(driver.state);
  let lastState: SearchState = driver.state;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const ours = (search: string) => {
    const all = new URLSearchParams(strip(search));
    const own = new URLSearchParams();
    all.forEach((value, key) => {
      if (codec.owns(key)) own.append(key, value);
    });
    return own.toString();
  };

  const applyUrl = () => {
    const search = adapter.read();
    const own = ours(search);
    if (own === lastWritten) return;
    clearTimeout(timer);
    // record the canonical form, so a hand-written URL is not rewritten
    lastWritten = codec.serialize(codec.parse(own));
    driver.setState(codec.parse(own));
    lastState = driver.state;
  };

  const write = () => {
    timer = undefined;
    const own = codec.serialize(driver.state);
    if (own === lastWritten) return;
    lastWritten = own;
    // keep everything that is not ours, then add ours
    const params = new URLSearchParams(strip(adapter.read()));
    for (const key of [...params.keys()])
      if (codec.owns(key)) params.delete(key);
    new URLSearchParams(own).forEach((value, key) => params.append(key, value));
    adapter.write(params.toString(), mode);
  };

  if (options.restore ?? true) {
    if (ours(adapter.read()) !== '') {
      lastWritten = '';
      applyUrl();
    }
  }

  const unsubscribe = driver.subscribe(({ state }) => {
    if (state === lastState) return; // a result change, not a state change
    lastState = state;
    clearTimeout(timer);
    if (debounceMs === 0) write();
    else timer = setTimeout(write, debounceMs);
  });
  const unlisten = adapter.listen(applyUrl);

  return () => {
    clearTimeout(timer);
    unsubscribe();
    unlisten();
  };
}

function strip(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}
