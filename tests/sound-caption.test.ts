// T-0097, roadmap step 25. Issues #104, #105, #106. #106 wins: a sound entry is 28 bytes.
// The compass says a direction and an urgency. It does not name a species or a distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERCEPTION, readPerception, readSoundEntry } from '../src/core/perceptionBuffer';
import { SENSES, cueSoundEntry, soundCaption, createSoundCues } from '../src/core/senses';
import { WOLF_NEEDS } from '../src/core/needs/species/index';

const known = new Uint8Array(readFileSync(new URL('./fixtures/perception-known.bin', import.meta.url)));
const SPECIES = /\b(wolf|deer|hare|loon|owl|raven|woodpecker|moose|bear|fox|lynx)\b/i;
const DISTANCE = /\d+\s*m\b|\bmetres?\b|\bmeters?\b|\d/;

test('T-0097: a snap caption is a direction and an urgency, read from the 28-byte entry', () => {
  const frame = readPerception(known);
  const soundAt = 160 + 2 * 48 + 32;
  const first = known.subarray(soundAt, soundAt + PERCEPTION.soundBytes);
  const second = known.subarray(soundAt + PERCEPTION.soundBytes, soundAt + 2 * PERCEPTION.soundBytes);
  assert.equal(PERCEPTION.soundBytes, 28);
  assert.equal(first.byteLength, 28);
  assert.equal(readSoundEntry(first).category, frame.sounds[0].category);
  assert.equal(readSoundEntry(first).urgency, 2);
  assert.equal(readSoundEntry(first).directionX, 1);
  assert.equal(readSoundEntry(second).directionZ, 1);
  assert.equal(soundCaption(first), 'something, right, loud');
  assert.equal(soundCaption(second), 'something, ahead, loud');
  assert.equal(SPECIES.test(soundCaption(first)), false);
  assert.equal(DISTANCE.test(soundCaption(first)), false);
  assert.throws(() => readSoundEntry(first.subarray(0, 24)), /28/);
});

test('T-0097: the words follow the entry, not the clip id or a distance', () => {
  const loud = cueSoundEntry({ level: 0.9, age: 0.2 }, 0);
  const soft = cueSoundEntry({ level: 0.2, age: 1 }, Math.PI);
  const clear = cueSoundEntry({ level: 0.5, age: 0 }, Math.PI / 2);
  assert.equal(loud.byteLength, 28);
  assert.equal(new DataView(loud.buffer).getUint16(0, true), 0); // category is not a species id
  assert.equal(soundCaption(loud), 'something, ahead, loud');
  assert.equal(soundCaption(soft), 'something, behind, soft');
  assert.equal(soundCaption(clear), 'something, right, clear');
  const view = new DataView(loud.buffer);
  view.setFloat32(4, 0.01, true); // intensity changes; urgency byte stays loud
  assert.equal(soundCaption(loud), 'something, ahead, loud');
  view.setUint16(2, 0, true);
  assert.equal(soundCaption(loud), 'something, ahead, soft');
  view.setUint16(0, 9, true); // a category code is still not printed
  assert.equal(soundCaption(loud), 'something, ahead, soft');
  assert.equal(SPECIES.test('deer-snort hare-squeak wolf 40 m'), true);
  for (const caption of [soundCaption(loud), soundCaption(soft), soundCaption(clear)]) {
    assert.equal(SPECIES.test(caption), false, caption);
    assert.equal(DISTANCE.test(caption), false, caption);
  }
  const flat = new Uint8Array(28);
  new DataView(flat.buffer).setUint16(2, 2, true);
  assert.equal(soundCaption(flat), 'something, that way, loud');
});

test('T-0097: cues stay on createSoundCues, and hearing range stays the species row', () => {
  const cues = createSoundCues();
  cues.add('deer-snort', { x: 10, z: 0 }, 0.9);
  const cue = cues.list()[0];
  assert.equal(cue.id, 'deer-snort');
  const entry = cueSoundEntry(cue, 0);
  assert.equal(soundCaption(entry), 'something, ahead, loud');
  assert.equal(soundCaption(cueSoundEntry({ level: 1, age: 0 }, -Math.PI / 2)), 'something, left, loud');
  assert.equal(SENSES.range, WOLF_NEEDS.senses.hearing.rangeM.v);
  assert.equal(WOLF_NEEDS.senses.hearing.rangeM.v, 40);
  const species = readFileSync(new URL('../src/core/needs/species/index.ts', import.meta.url), 'utf8');
  assert.match(species, /hearing: \{ rangeM: S\(40, 'footfalls of small prey', 'game calibration/);
  const hud = readFileSync(new URL('../src/ui/senses.ts', import.meta.url), 'utf8');
  assert.match(hud, /createSoundCues\(/);
  assert.match(hud, /soundCaption\(cueSoundEntry\(/);
  assert.match(hud, /SENSES\.range/);
  assert.doesNotMatch(hud, /soundNames|Deer snort|replaceAll\('-', ' '\)/);
  const line = hud.split('\n').find(l => l.includes('heard.textContent')) ?? '';
  assert.equal(SPECIES.test(line), false, line);
  assert.doesNotMatch(line, /\d+\s*m/);
});
