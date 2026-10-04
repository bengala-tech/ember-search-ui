import { module, test } from 'qunit';
import type { SearchContextState } from '@elastic/search-ui';
import { mapContextToProps } from '#src/helpers/map-context-to-props.ts';

// These tests feed partial / arbitrary contexts on purpose.
type AnyKey = keyof SearchContextState;
const ctx = (value: object) => value as unknown as SearchContextState;
const keys = (...names: string[]) => names as AnyKey[];
// Compare as plain objects; the mapped type is irrelevant here.
const plain = (value: object): object => value;

module('Unit | Helper | map-context-to-props', function () {
  test('it plucks only the requested keys', function (assert) {
    const pick = mapContextToProps(['searchTerm', 'current']);
    assert.deepEqual(
      pick(ctx({ searchTerm: 'zion', current: 2, results: [] })),
      {
        searchTerm: 'zion',
        current: 2,
      },
    );
  });

  test('it skips keys missing from the context but keeps falsy values', function (assert) {
    const pick = mapContextToProps(keys('error', 'missing'));
    assert.deepEqual(plain(pick(ctx({ error: '' }))), { error: '' });
  });

  test('it ignores inherited properties', function (assert) {
    const context = Object.create({ inherited: true }) as Record<
      string,
      unknown
    >;
    context['own'] = 1;
    assert.deepEqual(
      plain(mapContextToProps(keys('inherited', 'own'))(ctx(context))),
      { own: 1 },
    );
  });

  test('it defaults to an empty selection', function (assert) {
    assert.deepEqual(plain(mapContextToProps()(ctx({ a: 1 }))), {});
  });
});
