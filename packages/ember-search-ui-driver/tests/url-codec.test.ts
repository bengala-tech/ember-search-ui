import fc from 'fast-check';
import { describe, expect, test, vi } from 'vitest';
import {
  and,
  anyOf,
  createState,
  date,
  dateMath,
  disabled,
  eq,
  materialize,
  nested,
  not,
  or,
  range,
  sequentialIds,
  urlCodec,
  where,
  withId,
  type GroupNode,
  type NodeInput,
  type SearchState,
} from '../src/index.ts';
import { randomTree } from './arbitraries.ts';

const rootOf = (...children: NodeInput[]): GroupNode =>
  materialize(
    { ...and(...children), id: 'root' },
    sequentialIds(),
  ) as GroupNode;

const stateWith = (patch: Partial<SearchState>) => createState(patch);

describe('urlCodec', () => {
  const codec = urlCodec();

  test('an untouched search writes nothing', () => {
    expect(codec.serialize(createState())).toBe('');
    expect(codec.parse('')).toEqual(createState());
  });

  test('simple values stay readable', () => {
    const state = stateWith({
      query: { term: 'red rock' },
      sort: [
        { field: 'visitors', direction: 'desc' },
        { field: 'title', direction: 'asc' },
      ],
      page: { kind: 'offset', page: 3, perPage: 50 },
    });
    expect(codec.serialize(state)).toBe(
      'q=red+rock&sort=-visitors%2Ctitle&page=3&per=50',
    );
    expect(
      codec.parse('?q=red+rock&sort=-visitors,title&page=3&per=50'),
    ).toEqual(state);
  });

  test('(x is b and u is k) or (t is k and x is c) round-trips with ids', () => {
    const filter = rootOf(
      withId(
        'either',
        or(and(eq('x', 'b'), eq('u', 'k')), and(eq('t', 'k'), eq('x', 'c'))),
      ),
    );
    const search = codec.serialize(stateWith({ filter }));
    expect(decodeURIComponent(search)).toBe(
      'f=["g","root","","and",[["g","either","","or",[["g","n1","","and",[["c","n2","","x","eq","b"],["c","n3","","u","eq","k"]]],["g","n4","","and",[["c","n5","","t","eq","k"],["c","n6","","x","eq","c"]]]]]]]',
    );
    expect(codec.parse(search).filter).toEqual(filter);
  });

  test('negation, disabled, nested scopes, meta, dates and value-less conditions round-trip', () => {
    const filter = rootOf(
      not(or(eq('x', 'b'), disabled(anyOf('u', ['k', 'z'])))),
      not(
        disabled(
          nested(
            'requirements',
            and(eq('kind', 'permit'), range('due', { gte: dateMath('now/M') })),
            'every',
          ),
        ),
      ),
      {
        ...range('created', { gte: date('2024-01-01') }),
        meta: { owner: 'facet:created' },
      },
      not(where('t', 'eq')), // a half-filled query builder row
    );
    const state = stateWith({ filter });
    expect(codec.parse(codec.serialize(state))).toEqual(state);
  });

  test('any random tree round-trips exactly', () => {
    fc.assert(
      fc.property(randomTree, (input) => {
        const state = stateWith({ filter: rootOf(input) });
        expect(codec.parse(codec.serialize(state))).toEqual(state);
      }),
    );
  });

  test('only values that differ from the defaults are written', () => {
    const defaults = stateWith({
      filter: rootOf(withId('preset', eq('state', 'open'))),
      sort: [{ field: 'created', direction: 'desc' }],
      page: { kind: 'offset', page: 1, perPage: 50 },
    });
    const custom = urlCodec({ defaults });
    expect(custom.serialize(defaults)).toBe('');
    expect(custom.parse('')).toEqual(defaults);

    // removing the preset filter must be written, so it survives a reload
    const cleared = {
      ...defaults,
      filter: { ...defaults.filter, children: [] },
    };
    expect(custom.serialize(cleared)).toBe(
      `f=${encodeURIComponent('["g","root","","and",[]]')}`,
    );
    expect(custom.parse(custom.serialize(cleared))).toEqual(cleared);
  });

  test('a prefix keeps several searches on one page apart', () => {
    const reports = urlCodec({ prefix: 'r.' });
    expect(reports.serialize(stateWith({ query: { term: 'fire' } }))).toBe(
      'r.q=fire',
    );
    expect(reports.owns('r.q')).toBe(true);
    expect(reports.owns('q')).toBe(false);
    expect(reports.parse('q=other&r.q=fire').query.term).toBe('fire');
  });

  test('cursor paging', () => {
    const cursorDefaults = stateWith({
      page: { kind: 'cursor', cursor: null, size: 25 },
    });
    const cursorCodec = urlCodec({ defaults: cursorDefaults });
    const state = {
      ...cursorDefaults,
      page: { kind: 'cursor' as const, cursor: 'abc', size: 25 },
    };
    expect(cursorCodec.serialize(state)).toBe('cursor=abc');
    expect(cursorCodec.parse('cursor=abc')).toEqual(state);
  });

  test('sort fields that would be ambiguous fall back to JSON', () => {
    const state = stateWith({
      sort: [
        { field: 'a,b', direction: 'asc' },
        { field: '-odd', direction: 'desc' },
      ],
    });
    expect(codec.parse(codec.serialize(state))).toEqual(state);
  });

  test('extensions are opt-in', () => {
    const state = stateWith({ extensions: { 'api.refresh': true } });
    expect(codec.serialize(state)).toBe('');
    const withExtensions = urlCodec({ extensions: true });
    expect(withExtensions.parse(withExtensions.serialize(state))).toEqual(
      state,
    );
  });

  test('broken parameters are ignored, reported, and never throw', () => {
    const onInvalid = vi.fn();
    const lenient = urlCodec({ onInvalid });
    const parsed = lenient.parse(
      ['q=ok', 'f=not-json', 'page=-2', 'per=abc', 'sort=-'].join('&'),
    );
    expect(parsed).toEqual(stateWith({ query: { term: 'ok' } }));
    expect(onInvalid.mock.calls.map(([param]) => param as string)).toEqual([
      'f',
      'sort',
      'page',
      'per',
    ]);
  });

  test('filters with a wrong root, duplicate ids or bad nodes are rejected', () => {
    const onInvalid = vi.fn();
    const strict = urlCodec({ onInvalid });
    const bad = [
      '["g","other","","and",[]]',
      '["g","root","","and",[["c","a","","x","eq",1],["c","a","","y","eq",2]]]',
      '["g","root","","xor",[]]',
      '["g","root","?","and",[]]',
      '["c","root","","x","eq",1]',
      '["g","root","","and",[["q","a",""]]]',
    ];
    for (const f of bad) {
      expect(strict.parse(`f=${encodeURIComponent(f)}`).filter).toEqual(
        createState().filter,
      );
    }
    expect(onInvalid).toHaveBeenCalledTimes(bad.length);
  });
});
