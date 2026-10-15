import test from 'node:test'; import assert from 'node:assert/strict';
import { AnimalBrain } from '../src/core/animalBehavior';
import { createWolfModes } from '../src/core/wolfModes';
import { generateChunk } from '../src/core/world';
import { untagged, snapshot, restore, tagOf, STATE_FIELDS } from '../src/core/stateFields';
test('every state field is tagged clock / snapshot', () => {
  assert.deepEqual(untagged('brain', new AnimalBrain(1)), []);
  assert.deepEqual(untagged('modes', createWolfModes()), []);
  for (const e of [...generateChunk(0, 0), ...generateChunk(3, -2)]) assert.deepEqual(untagged('entity', e), [], e.kind);
  assert.deepEqual(untagged('player', { x: 0, z: 0, heading: 0, abilities: [] }), []);
  for (const g of Object.values(STATE_FIELDS)) for (const t of Object.values(g)) assert.ok(['clock', 'snapshot'].includes(t));
});
test('pause snapshot restores dynamic state exactly and never freezes clock fields', () => {
  const b = new AnimalBrain(1); b.energy = 50; b.speed = 1.2; b.heading = .7;
  const s = snapshot('brain', b); b.energy = 0; b.speed = 9; b.heading = 3;
  restore(b, s); assert.equal(b.energy, 50); assert.equal(b.speed, 1.2); assert.equal(b.heading, .7);
  assert.ok(!('seed' in s) && !('legs' in s), 'clock fields are not snapshotted'); assert.equal(tagOf('entity', 'scale'), 'clock'); assert.equal(tagOf('brain', 'energy'), 'snapshot', 'vitals are snapshot');
});
import { ageYears, lifespanWarning, LIFESPAN } from '../src/core/lifespan';
test('age follows the world clock; warning near the species maximum only', () => {
  const yr = 365.25 * 24 * 300;
  assert.equal(ageYears('wolf', 0, 0), LIFESPAN.wolf.startYears); assert.ok(Math.abs(ageYears('wolf', 0, 3 * yr) - 5) < 1e-9);
  assert.equal(lifespanWarning('wolf', 5), ''); assert.match(lifespanWarning('wolf', 12, 'Grey wolf'), /13 years/);
});
