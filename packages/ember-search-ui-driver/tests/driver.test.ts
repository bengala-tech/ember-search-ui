import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  SearchDriver,
  and,
  anyOf,
  eq,
  memoryBackend,
  nested,
  not,
  or,
  range,
  sequentialIds,
  withId,
  type Backend,
  type SearchState,
} from '../src/index.ts';
import { PARKS, XUT_DOCS, ids } from './fixtures.ts';

type Doc = { id: number };

const drivers: SearchDriver<unknown>[] = [];
afterEach(() => drivers.splice(0).forEach((d) => d.destroy()));

function setup<T extends Doc>(
  docs: T[],
  options: {
    latencyMs?: number;
    debounceMs?: number;
    searchOnInit?: boolean;
  } = {},
) {
  const inner = memoryBackend(
    docs,
    options.latencyMs ? { latencyMs: options.latencyMs } : {},
  );
  const search = vi.fn(inner.search);
  const backend = { ...inner, search };
  const driver = new SearchDriver<T>({
    backend,
    idFactory: sequentialIds(),
    ...(options.debounceMs !== undefined
      ? { debounceMs: options.debounceMs }
      : {}),
    ...(options.searchOnInit !== undefined
      ? { searchOnInit: options.searchOnInit }
      : {}),
  });
  drivers.push(driver as SearchDriver<unknown>);
  return { driver, search };
}

const resultIds = (driver: { result: { results: readonly Doc[] } }) =>
  ids(driver.result.results);

describe('nested groups', () => {
  test('build (x is b and u is k) or (t is k and x is c) one node at a time', async () => {
    const { driver } = setup(XUT_DOCS);
    const either = driver.add('root', or());
    const first = driver.add(either, and());
    driver.add(first, eq('x', 'b'));
    driver.add(first, eq('u', 'k'));
    const second = driver.add(either, and());
    driver.add(second, eq('t', 'k'));
    driver.add(second, eq('x', 'c'));
    await driver.settled();

    expect(resultIds(driver)).toEqual([1, 2, 5]);
    expect(driver.state.filter).toMatchObject({
      id: 'root',
      children: [
        {
          op: 'or',
          children: [
            {
              op: 'and',
              children: [
                { field: 'x', value: 'b' },
                { field: 'u', value: 'k' },
              ],
            },
            {
              op: 'and',
              children: [
                { field: 't', value: 'k' },
                { field: 'x', value: 'c' },
              ],
            },
          ],
        },
      ],
    });
  });

  test('or add the whole tree at once with builders', async () => {
    const { driver } = setup(XUT_DOCS);
    driver.add(
      'root',
      or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
    );
    await driver.settled();
    expect(resultIds(driver)).toEqual([1, 2, 5]);
  });

  test('edit any node of the tree by id', async () => {
    const { driver } = setup(XUT_DOCS);
    driver.add(
      'root',
      or(
        withId(
          'first',
          and(withId('xb', eq('x', 'b')), withId('uk', eq('u', 'k'))),
        ),
        withId(
          'second',
          and(withId('tk', eq('t', 'k')), withId('xc', eq('x', 'c'))),
        ),
      ),
    );
    await driver.settled();
    expect(resultIds(driver)).toEqual([1, 2, 5]);

    driver.update('xc', { value: 'b' }); // second branch: t is k and x is b
    await driver.settled();
    expect(resultIds(driver)).toEqual([1, 3, 5]);

    driver.toggleNegate('first'); // NOT (x is b and u is k) or (t is k and x is b)
    await driver.settled();
    expect(resultIds(driver)).toEqual([2, 3, 4, 5, 6]);

    driver.toggleNegate('first');
    driver.toggleDisabled('second'); // only the first branch counts
    await driver.settled();
    expect(resultIds(driver)).toEqual([1, 5]);

    driver.move('tk', 'first'); // first: x is b and u is k and t is k
    await driver.settled();
    expect(resultIds(driver)).toEqual([5]);

    driver.remove('first');
    await driver.settled();
    expect(resultIds(driver)).toEqual(ids(XUT_DOCS)); // only a disabled group left
  });

  test('nested scopes through the driver', async () => {
    const { driver } = setup(PARKS);
    driver.add(
      'root',
      or(
        nested('requirements', and(eq('kind', 'permit'), eq('status', 'fail'))),
        eq('title', 'Zion'),
      ),
    );
    await driver.settled();
    expect(resultIds(driver)).toEqual([2, 3]);
  });
});

describe('searching', () => {
  test('commands made in the same tick search once', async () => {
    const { driver, search } = setup(XUT_DOCS);
    await driver.settled();
    search.mockClear();
    driver.add('root', eq('x', 'b'));
    driver.add('root', eq('u', 'k'));
    await driver.settled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(resultIds(driver)).toEqual([1, 5]);
  });

  test('a transaction searches once, even across awaits of other work', async () => {
    const { driver, search } = setup(XUT_DOCS, { searchOnInit: false });
    driver.transaction((d) => {
      const group = d.add('root', or());
      d.add(group, eq('x', 'a'));
      d.add(group, eq('x', 'c'));
      d.setSort([{ field: 'id', direction: 'desc' }]);
    });
    await driver.settled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(resultIds(driver)).toEqual([6, 4, 2]);
  });

  test('setQuery debounces typing', async () => {
    const { driver, search } = setup(PARKS);
    await driver.settled();
    search.mockClear();
    for (const term of ['y', 'ye', 'yel', 'yell'])
      driver.setQuery(term, { debounceMs: 20 });
    await driver.settled();
    expect(search).toHaveBeenCalledTimes(1);
    expect(resultIds(driver)).toEqual([2]);
  });

  test('a slow, outdated response never overwrites a newer one', async () => {
    let calls = 0;
    const inner = memoryBackend(XUT_DOCS);
    const backend: Backend<
      SearchState,
      Awaited<ReturnType<typeof inner.search>>,
      Doc
    > = {
      ...inner,
      // first request answers after 40ms, later ones immediately; ignores abort
      search: async (state) => {
        const delay = calls++ === 0 ? 40 : 0;
        await new Promise((r) => setTimeout(r, delay));
        return inner.search(state, new AbortController().signal);
      },
    };
    const driver = new SearchDriver<Doc>({
      backend,
      idFactory: sequentialIds(),
      searchOnInit: false,
    });
    drivers.push(driver as SearchDriver<unknown>);

    driver.add('root', eq('x', 'b'));
    await new Promise((r) => setTimeout(r, 5)); // first search is in flight
    driver.update('n1', { value: 'c' });
    await driver.settled();
    await new Promise((r) => setTimeout(r, 60)); // let the stale response arrive
    expect(resultIds(driver)).toEqual([2, 4]);
    expect(driver.result.status).toBe('success');
  });

  test('a new search aborts the request in flight', async () => {
    const signals: AbortSignal[] = [];
    const inner = memoryBackend(XUT_DOCS, { latencyMs: 30 });
    const driver = new SearchDriver<Doc>({
      backend: {
        ...inner,
        search: (state: SearchState, signal: AbortSignal) => {
          signals.push(signal);
          return inner.search(state, signal);
        },
      },
      idFactory: sequentialIds(),
    });
    drivers.push(driver as SearchDriver<unknown>);
    await new Promise((r) => setTimeout(r, 5));
    driver.add('root', eq('x', 'a'));
    await driver.settled();
    expect(signals[0]?.aborted).toBe(true);
    expect(resultIds(driver)).toEqual([6]);
  });

  test('status goes loading -> success, and subscribers see each snapshot', async () => {
    const { driver } = setup(XUT_DOCS, { searchOnInit: false });
    const statuses: string[] = [];
    const off = driver.subscribe((s) => statuses.push(s.result.status));
    driver.add('root', eq('x', 'c'));
    await driver.settled();
    off();
    driver.add('root', eq('u', 'k'));
    await driver.settled();
    expect(statuses).toEqual(['idle', 'loading', 'success']);
  });

  test('errors are state; the last good results stay visible', async () => {
    let fail = false;
    const inner = memoryBackend(XUT_DOCS);
    const driver = new SearchDriver<Doc>({
      backend: {
        ...inner,
        search: (state: SearchState, signal: AbortSignal) =>
          fail
            ? Promise.reject(new Error('boom'))
            : inner.search(state, signal),
      },
      idFactory: sequentialIds(),
    });
    drivers.push(driver as SearchDriver<unknown>);
    await driver.settled();
    fail = true;
    driver.add('root', eq('x', 'b'));
    await driver.settled();
    expect(driver.result.status).toBe('error');
    expect((driver.result.error as Error).message).toBe('boom');
    expect(driver.result.results).toHaveLength(XUT_DOCS.length);
  });

  test('incomplete conditions are skipped and reported, not errors', async () => {
    const { driver } = setup(XUT_DOCS);
    const half = driver.add('root', anyOf('x', []));
    driver.add('root', eq('u', 'k'));
    await driver.settled();
    expect(driver.result.status).toBe('success');
    expect(driver.result.warnings).toEqual([
      { nodeId: half, message: 'Invalid value for "in" on "x"' },
    ]);
    expect(resultIds(driver)).toEqual([1, 4, 5, 6]);
    expect(driver.findNode(half)).not.toHaveProperty('disabled'); // state is untouched
  });

  test('destroy stops all searching', async () => {
    const { driver, search } = setup(XUT_DOCS);
    await driver.settled();
    search.mockClear();
    driver.destroy();
    driver.add('root', eq('x', 'b'));
    await driver.settled();
    expect(search).not.toHaveBeenCalled();
  });
});

describe('paging, sorting and state', () => {
  test('filter, query, sort and page-size changes return to page 1; setPage does not', async () => {
    const { driver } = setup(PARKS);
    driver.setPerPage(2);
    driver.setPage(3);
    await driver.settled();
    expect(driver.state.page).toEqual({ kind: 'offset', page: 3, perPage: 2 });
    expect(driver.result).toMatchObject({ total: 5, pageCount: 3 });
    expect(resultIds(driver)).toEqual([5]);

    driver.add('root', range('visitors', { gte: 4_000_000 }));
    expect(driver.state.page).toMatchObject({ page: 1 });
    driver.setPage(2);
    driver.setSort([{ field: 'title', direction: 'asc' }]);
    expect(driver.state.page).toMatchObject({ page: 1 });
    await driver.settled();
    expect(resultIds(driver)).toEqual([5, 2]); // Acadia, Yellowstone
  });

  test('replaceFilter keeps the root id; setState validates the tree', async () => {
    const { driver } = setup(XUT_DOCS);
    driver.replaceFilter(or(eq('x', 'a'), not(eq('u', 'k'))));
    await driver.settled();
    expect(driver.state.filter.id).toBe('root');
    expect(resultIds(driver)).toEqual([2, 3, 6]);

    const bad = {
      ...driver.state,
      filter: { ...driver.state.filter, id: 'nope' },
    };
    expect(() => driver.setState(bad)).toThrow(/root group's id/);
    const dup = {
      ...driver.state,
      filter: {
        ...driver.state.filter,
        children: [
          ...driver.state.filter.children,
          driver.state.filter.children[0]!,
        ],
      },
    };
    expect(() => driver.setState(dup)).toThrow(/Duplicate node id/);
  });

  test('export / import go through a codec', () => {
    const { driver } = setup(XUT_DOCS, { searchOnInit: false });
    driver.add('root', eq('x', 'b'));
    const json = {
      serialize: (s: SearchState) => JSON.stringify(s),
      parse: (s: string) => JSON.parse(s) as SearchState,
    };
    const exported = driver.export(json);
    const { driver: other } = setup(XUT_DOCS, { searchOnInit: false });
    other.import(json, exported);
    expect(other.state).toEqual(driver.state);
  });

  test('extensions are namespaced pass-through options', () => {
    const { driver } = setup(XUT_DOCS, { searchOnInit: false });
    driver.setExtension('prysmex.refresh', true);
    expect(driver.state.extensions).toEqual({ 'prysmex.refresh': true });
    driver.setExtension('prysmex.refresh', undefined);
    expect(driver.state.extensions).toEqual({});
  });
});
