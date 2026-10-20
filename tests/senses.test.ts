import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bearingTo, scentLevel, smell, createSoundCues, SENSES } from '../src/core/senses';
const origin = { x: 0, z: 0 };
const deer = { ...origin, key: 'deer:1', kind: 'deer', potency: 1 };
test('sound/scent bearings rotate with the view, including sounds behind', () => {
  assert.equal(bearingTo(origin, { x: 0, z: -10 }, 0), 0);
  assert.equal(bearingTo(origin, { x: 10, z: 0 }, 0), Math.PI / 2);
  assert.equal(Math.abs(bearingTo(origin, { x: 0, z: 10 }, 0)), Math.PI);
  assert.ok(Math.abs(bearingTo(origin, { x: -10, z: 0 }, Math.PI / 2)) < 1e-10);
});
test('scent is stronger downwind, fades with distance, and stays bounded', () => {
  const wind = { x: 1, z: 0 };
  assert.ok(scentLevel({ x: 15, z: 0 }, deer, wind) > scentLevel({ x: -15, z: 0 }, deer, wind));
  assert.ok(scentLevel({ x: 15, z: 0 }, deer, wind) > scentLevel({ x: 15, z: 15 }, deer, wind));
  assert.ok(scentLevel({ x: 2, z: 0 }, deer, origin) > scentLevel({ x: 10, z: 0 }, deer, origin));
  assert.equal(scentLevel({ x: 41, z: 0 }, deer, wind), 0);
  assert.equal(scentLevel(origin, { ...deer, potency: 10 }, wind), 1);
});
test('scent thoughts preserve memory provenance without changing sources or saving strangers', () => {
  const sources = [deer, { ...deer, key: 'known', x: 1, remembered: true, friend: true }];
  const before = JSON.stringify(sources), hits = smell(origin, sources, origin, 0);
  assert.equal(hits[0].remembered, undefined);
  assert.equal(hits[1].friend, true);
  assert.equal(JSON.stringify(sources), before);
  assert.deepEqual(smell(origin, [{ ...deer, x: 60 }], origin, 0), []);
});
test('sound cues coalesce, cap, expire, and clear on menu transitions', () => {
  const cues = createSoundCues();
  cues.add('owl', origin); cues.step(1); cues.add('owl', { x: 1, z: 0 });
  assert.equal(cues.list().length, 1); assert.equal(cues.list()[0].age, 0);
  for (let i = 0; i < 30; i++) cues.add('step', { x: i * 5, z: 0 });
  assert.equal(cues.list().length, SENSES.cueCap);
  cues.step(SENSES.cueLife); assert.equal(cues.list().length, 0);
  cues.add('owl', origin); cues.clear(); assert.equal(cues.list().length, 0);
});
