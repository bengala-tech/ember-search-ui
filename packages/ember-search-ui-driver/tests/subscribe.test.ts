import { afterEach, describe, expect, test } from 'vitest';
import {
  SearchDriver,
  eq,
  memoryBackend,
  sequentialIds,
  type Snapshot,
} from '../src/index.ts';
import { XUT_DOCS } from './fixtures.ts';

const drivers: SearchDriver<unknown>[] = [];
afterEach(() => drivers.splice(0).forEach((d) => d.destroy()));

const create = () => {
  const driver = new SearchDriver<unknown>({
    backend: memoryBackend<unknown>(XUT_DOCS),
    idFactory: sequentialIds(),
    searchOnInit: false,
  });
  drivers.push(driver);
  return driver;
};

describe('subscribe: the hook for any framework', () => {
  test('a reactive store receives every snapshot, in order', async () => {
    // Stand-in for an Ember tracked field, a React external store, a signal...
    const store = { snapshot: undefined as Snapshot | undefined, renders: 0 };
    const driver = create();
    driver.subscribe(
      (snapshot) => {
        store.snapshot = snapshot;
        store.renders++;
      },
      { immediate: true },
    );
    expect(store.snapshot).toBe(driver.snapshot); // immediate

    driver.add('root', eq('x', 'b'));
    expect(store.snapshot?.state.filter.children).toHaveLength(1); // synchronous
    await driver.settled();
    expect(store.snapshot?.result.status).toBe('success');
    expect(store.snapshot?.result.total).toBe(3);
    // immediate, state change, loading, success
    expect(store.renders).toBe(4);
  });

  test('the snapshot keeps its identity until something changes', async () => {
    // what React's useSyncExternalStore and memoized getters need
    const driver = create();
    const before = driver.snapshot;
    expect(driver.snapshot).toBe(before);
    driver.add('root', eq('x', 'b'));
    const afterAdd = driver.snapshot;
    expect(afterAdd).not.toBe(before);
    expect(afterAdd.result).toBe(before.result); // result untouched by a state change
    await driver.settled();
    expect(driver.snapshot.state).toBe(afterAdd.state); // state untouched by results
  });

  test('state and results are immutable values', () => {
    const driver = create();
    const state = driver.state;
    driver.add('root', eq('x', 'b'));
    expect(state.filter.children).toHaveLength(0); // the old value never changes
  });

  test('unsubscribing, also from inside a listener, stops notifications', () => {
    const driver = create();
    const calls: string[] = [];
    const offB = driver.subscribe(() => calls.push('b'));
    driver.subscribe(() => {
      calls.push('a');
    });
    const offC = driver.subscribe(() => {
      calls.push('c');
      offB(); // b was already called this round; it is not called again
    });
    driver.add('root', eq('x', 'b'));
    expect(calls).toEqual(['b', 'a', 'c']);
    calls.length = 0;
    offC();
    driver.add('root', eq('u', 'k'));
    expect(calls).toEqual(['a']);
  });

  test('a listener removed by an earlier listener in the same round is skipped', () => {
    const driver = create();
    const calls: string[] = [];
    let offLate = () => {};
    driver.subscribe(() => {
      calls.push('early');
      offLate();
    });
    offLate = driver.subscribe(() => calls.push('late'));
    driver.add('root', eq('x', 'b'));
    expect(calls).toEqual(['early']);
  });
});

test('commands work detached from the driver (for template helpers)', async () => {
  const driver = create();
  const { add, toggleNegate, remove, setQuery, settled } = driver;
  const id = add('root', eq('x', 'b'));
  toggleNegate(id);
  expect(driver.findNode(id)?.negate).toBe(true);
  setQuery('z');
  remove(id);
  await settled();
  expect(driver.state.filter.children).toHaveLength(0);
});
