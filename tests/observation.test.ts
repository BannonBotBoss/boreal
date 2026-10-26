import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INTEREST, setInterestCentre } from '../src/core/interest';
import { heightAt } from '../src/core/world';
import { pauseClock, resumeClock } from '../src/core/worldClock';
import { OBSERVATION_SOURCES, observationRecord, registerObservationSources } from '../src/core/observation';

test('T-0081: the four fields are live copies of camera, ground, clock and playable', () => {
  const saved = { ...OBSERVATION_SOURCES };
  const cam = { x: 12, y: 50, z: -7 }; let id: string | null = 'wolf', rate = 1;
  registerObservationSources({ camera: () => cam, embodied: () => id, rate: () => rate });
  try {
  let o = observationRecord();
  assert.deepEqual([o.x, o.y, o.z], [12, 50, -7]);
  assert.equal(o.altitude, 50 - heightAt(12, -7));
  assert.equal(o.rate, 1); assert.equal(o.embodied, 'wolf');
  cam.x = 3; cam.y = 9; id = null; rate = 60; // sources change; the record follows with no stored copy
  o = observationRecord();
  assert.equal(o.x, 3); assert.equal(o.altitude, 9 - heightAt(3, -7)); assert.equal(o.rate, 60); assert.equal(o.embodied, null);
  } finally { Object.assign(OBSERVATION_SOURCES, saved); }
});

test('T-0081: the default rate reads 0 while the world clock is paused', () => {
  pauseClock(0);
  try { assert.equal(observationRecord().rate, 0); } finally { resumeClock(0); }
  assert.equal(observationRecord().rate, 1);
});

test('T-0081: without a camera the position is the one interest centre, standing on the ground', () => {
  setInterestCentre(4, 5);
  const o = observationRecord({ ...OBSERVATION_SOURCES, camera: null });
  assert.equal(o.x, INTEREST.x); assert.equal(o.z, INTEREST.z); assert.equal(o.altitude, 0);
});

test('T-0081: no second interest radius or clock; buildScene registers the camera and current playable', () => {
  const src = readFileSync(new URL('../src/core/observation.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /near\s*:|mid\s*:|performance\.now|Date\.now|new\s+\w*Clock/);
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  assert.match(scene, /registerObservationSources\(\{ camera: \(\) => camera\.position, embodied: \(\) => photoObserver \? null : current\.id \}\)/);
});
