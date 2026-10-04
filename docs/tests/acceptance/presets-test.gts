import { module, test } from 'qunit';
import { click, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'docs/tests/helpers';
import { TEST_URL } from 'docs/demo/session';
import type { Inspection } from 'docs/demo/data';
import { PRESETS } from 'docs/demos/presets';
import { panelJson, truth } from '../helpers/server';

const DAY = 86_400_000;
const time = (iso: string) => Date.parse(iso);
const isOpen = (d: Inspection) => !['done', 'cancelled'].includes(d.state);

// Each preset's meaning, written directly against the data: the ground
// truth the fake server's answers are checked against.
const EXPECTED: Record<string, (d: Inspection) => boolean> = {
  'open-high': (d) =>
    ['created', 'pending', 'in_progress'].includes(d.state) &&
    d.priority === 'high',
  'closed-elsewhere': (d) => !isOpen(d) && d.project !== 'Monterrey plant',
  'expensive-or-overdue': (d) =>
    (d.cost !== undefined && d.cost >= 3000) ||
    (d.due_at !== null && time(d.due_at) < Date.now() && isOpen(d)),
  'fire-season': (d) =>
    d.tags.some((t) => t === 'fire' || t === 'safety') &&
    time(d.created_at) >= time('2026-06-01') &&
    time(d.created_at) < time('2026-09-01'),
  'two-shapes': (d) =>
    ((d.priority === 'high' && d.state === 'pending') ||
      (d.priority === 'low' && d.state === 'done')) &&
    d.cost !== undefined,
  leaks: (d) =>
    d.description.toLowerCase().includes('leak') &&
    !d.title.toLowerCase().includes('kitchen'),
  'switched-off': (d) => d.project === 'Saltillo warehouse',
  recent: (d) => time(d.created_at) >= time('2026-09-30') - 90 * DAY,
};

// which presets the flat legacy list can express
const LIST_TOO = ['open-high', 'fire-season', 'switched-off', 'recent'];

module('Acceptance | filter presets', function (hooks) {
  setupApplicationTest(hooks);
  hooks.beforeEach(() => {
    TEST_URL.value = '';
  });

  test('every preset has an expected meaning', function (assert) {
    assert.deepEqual(
      PRESETS.map((p) => p.id).sort(),
      Object.keys(EXPECTED).sort(),
    );
  });

  test('each preset, sent as the groups spec, finds exactly what it means', async function (assert) {
    await visit('/examples/groups');
    for (const preset of PRESETS) {
      await click(`[data-test-preset="${preset.id}"]`);
      const expected = truth(EXPECTED[preset.id]!);
      assert
        .dom('[data-test-page]')
        .includesText(`· ${expected} inspections`, preset.id);
      assert
        .dom('[data-test-preset-note]')
        .hasText(new RegExp(preset.note.slice(0, 20).replace(/[()]/g, '\\$&')));
      assert.ok(panelJson('[data-test-sent]')['filters'], preset.id);
    }
    // the switched-off group is left out of the request
    await click('[data-test-preset="switched-off"]');
    assert.deepEqual(panelJson('[data-test-sent]')['filters'], {
      project: 'Saltillo warehouse',
    });
    await click('[data-test-preset-clear]');
    assert.dom('[data-test-page]').includesText('· 36 inspections');
  });

  test('badges say which presets the legacy list can send', async function (assert) {
    await visit('/guides/filtering');
    for (const preset of PRESETS) {
      assert
        .dom(`[data-test-preset="${preset.id}"] .preset-badge`)
        .hasText(
          LIST_TOO.includes(preset.id) ? 'legacy list too' : 'groups only',
          preset.id,
        );
    }
  });

  test('a preset shows in the query builder, the views and Show query', async function (assert) {
    await visit('/examples/properties');
    await click('[data-test-preset="open-high"]');
    assert
      .dom('[data-test-total]')
      .hasText(`${truth(EXPECTED['open-high']!)} inspections`);
    assert.dom('.advanced .sui-qb-condition').exists({ count: 2 });
    await click('[data-test-show-query]');
    await click('[data-test-inspector-tab="list"]');
    assert.dom('[data-test-inspector-output]').includesText('"field": "state"');
  });
});
