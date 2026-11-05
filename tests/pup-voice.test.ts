import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { LITTER, PUP_VOICE, pupCall, pupGap, pupPitch } from '../src/core/litter';
import { PUP_CLIPS, pickPupClip } from '../src/audio/pupVoice';

test('a pup yips near her, whimpers when set apart or needy, calls when left behind, and huffs at a nudge', () => {
  assert.equal(pupCall({ distM: 1, moving: true, ageYears: LITTER.emergeYears, hungry: false, tired: false, nudged: false }), 'yip');
  assert.equal(pupCall({ distM: 1, moving: false, ageYears: LITTER.emergeYears, hungry: false, tired: false, nudged: false }), 'yip');
  assert.equal(pupCall({ distM: 1, moving: false, ageYears: 1.2, hungry: false, tired: false, nudged: false }), null);
  assert.equal(pupCall({ distM: 3, moving: true, ageYears: LITTER.emergeYears, hungry: false, tired: false, nudged: false }), 'whimper');
  assert.equal(pupCall({ distM: 1, moving: true, ageYears: LITTER.emergeYears, hungry: true, tired: false, nudged: false }), 'whimper');
  assert.equal(pupCall({ distM: 1, moving: true, ageYears: LITTER.emergeYears, hungry: false, tired: true, nudged: false }), 'whimper');
  assert.equal(pupCall({ distM: PUP_VOICE.farM, moving: false, ageYears: LITTER.emergeYears, hungry: false, tired: false, nudged: false }), 'call');
  assert.equal(PUP_VOICE.farM, LITTER.rejoinM);
  assert.equal(pupCall({ distM: 0.4, moving: false, ageYears: 1.2, hungry: false, tired: false, nudged: true }), 'huff');
  assert.ok(pupPitch(LITTER.emergeYears) > pupPitch(1));
  assert.ok(Math.abs(pupPitch(1) - 1) < 1e-9);
  assert.ok(pupGap('huff') < pupGap('yip'));
});

test('the clip pick rotates through the bank and does not repeat the last file', () => {
  const seen = new Set<string>();
  let last: string | undefined;
  for (let i = 0; i < 8; i++) {
    last = pickPupClip('yip', () => (i % 4) / 4, last);
    seen.add(last);
    assert.equal(PUP_CLIPS.yip.includes(last), true);
  }
  assert.ok(seen.size >= 2);
  const again = pickPupClip('call', () => 0, 'call_01');
  assert.equal(again, 'call_02');
});

test('the pup clips are mono ogg in the sound folder, and the library credits ElevenLabs', () => {
  const names = readdirSync('public/sounds/pups').filter(n => n.endsWith('.ogg')).sort();
  assert.deepEqual(names, [
    'call_01.ogg', 'call_02.ogg',
    'huff_01.ogg', 'huff_02.ogg', 'huff_03.ogg',
    'whimper_01.ogg', 'whimper_02.ogg', 'whimper_03.ogg',
    'yip_01.ogg', 'yip_02.ogg', 'yip_03.ogg', 'yip_04.ogg',
  ]);
  for (const name of names) assert.equal(readFileSync(`public/sounds/pups/${name}`).subarray(0, 4).toString(), 'OggS', name);
  const credits = readFileSync('public/sounds/pups/CREDITS.md', 'utf8');
  assert.match(credits, /ElevenLabs/);
  assert.match(readFileSync('index.html', 'utf8'), /ElevenLabs Sound Effects/);
  assert.match(readFileSync('src/audio/borealSound.ts', 'utf8'), /sounds\/pups\/\$\{name\}\.ogg/);
  assert.match(readFileSync('src/audio/borealSound.ts', 'utf8'), /length >= 2/);
});
