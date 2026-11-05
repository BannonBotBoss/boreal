import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bootChoice, cleanResume, createContext, hasSeenBigBang, INTRO_DONE_EVENTS, introEventMarksSeen, loadResume, markBigBangSeen, parseContext, saveResume, type ResumePlace } from '../src/core/events';

const globe: ResumePlace = { mode: 'globe', lat: 64.5, lon: -119.7, alt: 14016, x: 12, z: -4, yaw: 0.2 };

test('the events save round-trips the intro flag and the last place', () => {
  const fresh = createContext();
  assert.equal(hasSeenBigBang(fresh), false);
  assert.equal(loadResume(fresh), null);
  const seen = markBigBangSeen(fresh);
  assert.notEqual(seen, fresh);
  assert.equal(hasSeenBigBang(seen), true);
  assert.equal(markBigBangSeen(seen), seen);
  const stored = saveResume(seen, globe);
  assert.equal(loadResume(seen), null);
  const loaded = parseContext(JSON.stringify(stored));
  assert.equal(hasSeenBigBang(loaded), true);
  assert.deepEqual(loadResume(loaded), globe);
  const old = parseContext(JSON.stringify(createContext()));
  assert.equal(hasSeenBigBang(old), false);
  assert.equal(loadResume(old), null);
});

test('a damaged place is dropped and the events save still loads', () => {
  const junk = parseContext(JSON.stringify({ ...createContext(), introComplete: 'yes', resume: { mode: 'orbit', lat: 99 } }));
  assert.equal(hasSeenBigBang(junk), false);
  assert.equal(loadResume(junk), null);
  const kept = parseContext(JSON.stringify({ ...createContext(), introComplete: true, resume: { mode: 'game', lat: 120, x: 3, z: 4, yaw: 1 } }));
  assert.equal(hasSeenBigBang(kept), true);
  assert.deepEqual(loadResume(kept), { mode: 'game', x: 3, z: 4, yaw: 1 });
  assert.equal(cleanResume({ mode: 'nope' }), null);
  assert.equal(saveResume(createContext(), { mode: 'game' }).resume?.mode, 'game');
});

test('a first visit stays on the cosmic intro; a return visit skips it and restores the place', () => {
  assert.equal(bootChoice('sphere', false, globe), 'sphere');
  assert.equal(bootChoice('sphere', false, null), 'sphere');
  assert.equal(bootChoice('sphere', true, null), 'globe');
  assert.equal(bootChoice('sphere', true, { mode: 'game', x: 8, z: -3, yaw: 1 }), 'resume-game');
  assert.equal(bootChoice('sphere', true, { mode: 'band', x: 8, z: -3 }), 'resume-game');
  assert.equal(bootChoice('sphere', true, globe), 'resume-globe');
  assert.equal(bootChoice('sphere', true, { mode: 'globe', x: 1, z: 2 }), 'resume-game');
  assert.equal(bootChoice('ground', true, globe), 'ground');
  assert.equal(bootChoice('globe', false, null), 'globe');
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /opened === 'sphere'/);
  assert.match(main, /choice === 'sphere'/);
  assert.match(main, /createOpening\(/);
  assert.match(main, /hasSeenBigBang\(context\)/);
  assert.match(main, /markIntroFlag\(\)/);
  assert.match(main, /INTRO_DONE_EVENTS/);
  assert.match(main, /addEventListener\(type, mark\)/);
  assert.equal(introEventMarksSeen('cinematic:complete'), true);
  assert.equal(introEventMarksSeen('cinematic:dismiss'), true);
  assert.equal(introEventMarksSeen('intro-dismiss'), true);
  assert.equal(introEventMarksSeen('cinematic:start'), false);
  assert.ok(INTRO_DONE_EVENTS.includes('cinematic:complete'));
  assert.match(readFileSync('src/world/globe/inpage.ts', 'utf8'), /globeAim/);
  assert.equal(readFileSync('src/world/cosmos/opening.ts', 'utf8').includes('introComplete'), false);
});
