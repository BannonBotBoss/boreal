import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { MUSIC_SETTINGS, MUSIC_SAFETY, MUSIC_PANEL, TRACK_OPTIONS, sourceOf } from '../src/audio/musicSettings';
import { GUITAR_TRACKS, MUSIC, PULSE_PRESETS } from '../src/audio/music';
import { createSettingsStore } from '../src/core/renderSettings';
const mem = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
test('music settings: defaults are gamma 40 Hz, carrier in 200–400 Hz, presets cover gamma/alpha/theta/delta, safety note present', () => {
  for (const d of MUSIC_SETTINGS) d.apply(d.default);
  assert.equal(MUSIC.pulse, 40); assert.ok(MUSIC.carrier >= 200 && MUSIC.carrier <= 400);
  assert.deepEqual(Object.values(PULSE_PRESETS), [40, 10, 6, 2]);
  assert.match(MUSIC_SAFETY, /photosensitive/); assert.match(MUSIC_SAFETY, /volume/);
});
test('music picker: three guitar tracks then Off, first track by default, panel shows only the picker', () => {
  assert.deepEqual(TRACK_OPTIONS, ['Fingerpicked', 'Open tuning', 'Campfire', 'Off']);
  for (const d of MUSIC_SETTINGS) d.apply(d.default);
  assert.equal(MUSIC.source, 'Fingerpicked');
  assert.deepEqual(MUSIC_PANEL.map(d => d.id), ['music.source']);
});
test('music picker: the choice persists, and old saved sources fall back to the first guitar track', () => {
  const s = mem(); createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1', s).set('music.source', 'Campfire');
  createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1', s); assert.equal(MUSIC.source, 'Campfire');
  createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1', mem({ 'boreal.music.v1': JSON.stringify({ 'music.source': 'Built-in ambient' }) }));
  assert.equal(MUSIC.source, 'Fingerpicked');
  createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1', mem({ 'boreal.music.v1': JSON.stringify({ 'music.source': 'Off' }) }));
  assert.equal(MUSIC.source, 'Off');
  assert.equal(sourceOf('Isochronic tones', true), 'Isochronic tones'); assert.equal(sourceOf('nonsense', true), 'Fingerpicked');
});
test('music manifest: lists exactly the guitar tracks with source, licence and prompt; files exist and stay small', () => {
  const m = JSON.parse(readFileSync('public/music/manifest.json', 'utf8')) as { tracks: { file: string; title: string; source: string; licence: string; prompt: string }[] };
  assert.deepEqual(m.tracks.map(t => [t.file, t.title]), GUITAR_TRACKS.map(t => [t.file, t.title]));
  for (const t of m.tracks) {
    assert.match(t.source, /ElevenLabs/); assert.ok(t.licence.length > 20); assert.match(t.prompt, /no vocals/);
    const size = statSync(`public/music/${t.file}`).size; assert.ok(size > 1e6 && size < 3e6, `${t.file} ${size} bytes`);
  }
});
