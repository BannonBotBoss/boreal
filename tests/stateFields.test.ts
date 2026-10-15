import test from 'node:test'; import assert from 'node:assert/strict';
import { AnimalBrain } from '../src/core/animalBehavior';
import { createWolfModes } from '../src/core/wolfModes';
import { generateChunk } from '../src/core/world';
import { untagged, tagOf, STATE_FIELDS } from '../src/core/stateFields';
test('every state field is tagged clock / snapshot', () => {
  assert.deepEqual(untagged('brain', new AnimalBrain(1)), []);
  assert.deepEqual(untagged('modes', createWolfModes()), []);
  for (const e of [...generateChunk(0, 0), ...generateChunk(3, -2)]) assert.deepEqual(untagged('entity', e), [], e.kind);
  assert.deepEqual(untagged('player', { x: 0, z: 0, heading: 0, abilities: [] }), []);
  for (const g of Object.values(STATE_FIELDS)) for (const t of Object.values(g)) assert.ok(['clock', 'snapshot'].includes(t));
});
test('vitals are snapshot; age/growth fields are clock', () => {
  assert.equal(tagOf('brain', 'energy'), 'snapshot'); assert.equal(tagOf('entity', 'scale'), 'clock');
  assert.equal(tagOf('modes', 'stamina'), 'snapshot'); assert.equal(tagOf('world', 'season'), 'clock');
});
import { ageYears, lifespanWarning, LIFESPAN } from '../src/core/lifespan';
test('age follows the world clock; warning near the species maximum only', () => {
  const yr = 365.25 * 24 * 300;
  assert.equal(ageYears('wolf', 0, 0), LIFESPAN.wolf.startYears); assert.ok(Math.abs(ageYears('wolf', 0, 3 * yr) - 5) < 1e-9);
  assert.equal(lifespanWarning('wolf', 5), ''); assert.match(lifespanWarning('wolf', 12, 'Grey wolf'), /13 years/);
});
