import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  SearchDriver,
  and,
  eq,
  memoryBackend,
  memoryHistory,
  or,
  sequentialIds,
  syncUrl,
  urlCodec,
} from '../src/index.ts';
import { XUT_DOCS, ids } from './fixtures.ts';

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

function setup(url = '', options: Parameters<typeof syncUrl>[1] = {}) {
  const history = memoryHistory(url);
  const write = vi.spyOn(history, 'write');
  const driver = new SearchDriver({
    backend: memoryBackend(XUT_DOCS),
    idFactory: sequentialIds(),
  });
  const stop = syncUrl(driver, { adapter: history, debounceMs: 0, ...options });
  cleanups.push(stop, () => driver.destroy());
  return { driver, history, write, stop };
}

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('syncUrl', () => {
  test('restores filters, sort and page from the URL on start', async () => {
    const codec = urlCodec();
    const source = new SearchDriver({
      backend: memoryBackend(XUT_DOCS),
      idFactory: sequentialIds(),
      searchOnInit: false,
    });
    source.add(
      'root',
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    );
    source.setSort([{ field: 'id', direction: 'desc' }]);
    const url = `?${codec.serialize(source.state)}&tab=details`;
    source.destroy();

    const { driver, write } = setup(url);
    expect(driver.state.filter).toEqual(source.state.filter);
    expect(driver.state.sort).toEqual([{ field: 'id', direction: 'desc' }]);
    await driver.settled();
    expect(ids(driver.result.results)).toEqual([5, 2, 1]);
    expect(write).not.toHaveBeenCalled(); // restoring does not rewrite the URL
  });

  test('writes changes as history entries and keeps unrelated params', async () => {
    const { driver, history } = setup('?tab=details');
    driver.add('root', eq('x', 'b'));
    await tick();
    driver.setPage(2);
    await tick();
    expect(history.entries).toHaveLength(3);
    const last = new URLSearchParams(history.read());
    expect(last.get('tab')).toBe('details');
    expect(last.get('page')).toBe('2');
    expect(JSON.parse(last.get('f')!)).toEqual([
      'g',
      'root',
      '',
      'and',
      [['c', 'n1', '', 'x', 'eq', 'b']],
    ]);
  });

  test('typing is debounced into one entry', async () => {
    const { driver, history } = setup('', { debounceMs: 20 });
    for (const term of ['y', 'ye', 'yel']) driver.setQuery(term);
    await tick(40);
    expect(history.entries).toEqual(['', 'q=yel']);
  });

  test('result changes alone never write', async () => {
    const { driver, write } = setup();
    await driver.settled();
    await driver.refresh();
    await tick();
    expect(write).not.toHaveBeenCalled();
  });

  test('back and forward move the driver, without writing new entries', async () => {
    const { driver, history, write } = setup();
    driver.add('root', eq('x', 'b'));
    await tick();
    driver.add('root', eq('u', 'k'));
    await tick();
    expect(write).toHaveBeenCalledTimes(2);

    history.back();
    expect(driver.state.filter.children).toHaveLength(1);
    await driver.settled();
    expect(ids(driver.result.results)).toEqual([1, 3, 5]);

    history.back();
    expect(driver.state.filter.children).toHaveLength(0);
    history.forward();
    history.forward();
    expect(driver.state.filter.children).toHaveLength(2);
    await tick();
    expect(write).toHaveBeenCalledTimes(2);
  });

  test('replace mode rewrites the current entry', async () => {
    const { driver, history } = setup('', { history: 'replace' });
    driver.add('root', eq('x', 'b'));
    await tick();
    driver.setPage(2);
    await tick();
    expect(history.entries).toHaveLength(1);
    expect(history.read()).toContain('page=2');
  });

  test('restore: false ignores the URL on start', () => {
    const { driver } = setup('?q=zion', { restore: false });
    expect(driver.state.query.term).toBe('');
  });

  test('stop disconnects both directions', async () => {
    const { driver, history, write, stop } = setup();
    stop();
    driver.add('root', eq('x', 'b'));
    await tick();
    expect(write).not.toHaveBeenCalled();
    history.write('q=zion', 'push');
    history.back();
    history.forward();
    expect(driver.state.query.term).toBe('');
  });

  test('the defaults are the driver state when sync starts', async () => {
    const driver = new SearchDriver({
      backend: memoryBackend(XUT_DOCS),
      initialState: { page: { kind: 'offset', page: 1, perPage: 50 } },
    });
    const history = memoryHistory();
    cleanups.push(syncUrl(driver, { adapter: history, debounceMs: 0 }), () =>
      driver.destroy(),
    );
    driver.setQuery('zion');
    await tick();
    expect(history.read()).toBe('q=zion'); // per=50 is the default, not written
  });
});

test('a hand-written URL reached by back/forward adds no history entry', async () => {
  const { driver, history, write } = setup();
  history.write('page=02&q=zion', 'push'); // e.g. a link someone typed
  history.back();
  history.forward();
  expect(driver.state.query.term).toBe('zion');
  expect(driver.state.page).toMatchObject({ page: 2 });
  await tick();
  expect(write).toHaveBeenCalledTimes(1); // only the external write above
  expect(history.entries).toEqual(['', 'page=02&q=zion']);
});
