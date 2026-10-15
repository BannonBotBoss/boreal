import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC_SETTINGS, MUSIC_SAFETY } from '../src/audio/musicSettings';
import { MUSIC, PULSE_PRESETS } from '../src/audio/music';
test('music settings: defaults are gamma 40 Hz, carrier in 200–400 Hz, presets cover gamma/alpha/theta/delta, safety note present', () => {
  for (const d of MUSIC_SETTINGS) d.apply(d.default);
  assert.equal(MUSIC.pulse, 40); assert.ok(MUSIC.carrier >= 200 && MUSIC.carrier <= 400);
  assert.deepEqual(Object.values(PULSE_PRESETS), [40, 10, 6, 2]);
  assert.match(MUSIC_SAFETY, /photosensitive/); assert.match(MUSIC_SAFETY, /volume/);
});
