import { test } from 'node:test';
import assert from 'node:assert/strict';
import { admitVoice, busOf, createVolumeStore, BUS_LEVEL, BUS_STATE, CLIP_TRIM_DB, VOICES, VOLUME_SETTINGS, type ActiveVoice } from '../src/audio/mixer';
import { SOUND_IDS } from '../src/audio/borealSound';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const v = (id: string, priority: number, start: number): ActiveVoice => ({ id, priority, start });

test('mixer: per-clip cap steals that clip\'s oldest voice', () => {
  const a = [v('paw-run', 2, 1), v('paw-run', 2, 0), v('owl', 3, 0)];
  assert.deepEqual(admitVoice(a, 'paw-run', 2), { ok: true, steal: 1 });
  assert.deepEqual(admitVoice(a, 'owl', 3), { ok: true, steal: -1 });
});
test('mixer: global cap steals the lowest priority, never something more important than the newcomer', () => {
  const cfg = { ...VOICES, max: 3 };
  const full = [v('wolf-howl', 9, 0), v('paw-walk', 1, 2), v('chew', 2, 1)];
  assert.deepEqual(admitVoice(full, 'pounce', 8, cfg), { ok: true, steal: 1 });
  const loud = [v('wolf-howl', 9, 0), v('pounce', 8, 1), v('land', 7, 2)];
  assert.deepEqual(admitVoice(loud, 'paw-walk', 1, cfg), { ok: false, steal: -1 });
  const tie = [v('raven', 2, 5), v('chew', 2, 1), v('owl', 3, 0)];
  assert.equal(admitVoice(tie, 'paw-run', 2, cfg).steal, 1); // oldest among equals
});
test('mixer: every clip has a loudness trim within ±18 dB and a bus; music and ambience loops are routed off the sfx bus', () => {
  for (const id of SOUND_IDS) { assert.ok(id in CLIP_TRIM_DB, id); assert.ok(Math.abs(CLIP_TRIM_DB[id]) <= 18, id); }
  assert.equal(busOf('music-day'), 'music'); assert.equal(busOf('amb-night'), 'ambience'); assert.equal(busOf('ui-click'), 'ui'); assert.equal(busOf('wolf-howl'), 'sfx');
});
test('mixer: volume store persists bus levels and migrates the old master/music keys once', () => {
  const s = mem(); s.setItem('boreal.audio.v1', JSON.stringify({ volume: .4, musicVolume: .2, muted: true, musicOn: false }));
  const store = createVolumeStore(s);
  assert.equal(BUS_LEVEL.master, .4); assert.equal(BUS_LEVEL.music, .2); assert.equal(BUS_STATE.muted, true); assert.equal(BUS_STATE.musicOn, false);
  store.set('volume.sfx', .5); assert.equal(BUS_LEVEL.sfx, .5); assert.equal(JSON.parse(s.getItem('boreal.volume.v1')!)['volume.sfx'], .5);
  store.reset(); for (const d of VOLUME_SETTINGS) assert.equal(store.get(d.id), d.default);
});
