/**
 * T-0107, roadmap step 17. Issues #102 and #103.
 * Entering uses an animal the store already recorded. The embodied id on the
 * step 1 record is that store id. A second entry keeps the memory marks.
 * Step 22 is not on main. This test is the slot it will fill.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ageInsideLifespan, enterLiving, livingRoster, WITNESS_ALTITUDE_SCALE } from '../src/core/enterLiving';
import { LIVING_PACK } from '../src/core/livingPack';
import { LIFESPAN } from '../src/core/lifespan';
import { observationRecord, registerObservationSources, OBSERVATION_SOURCES } from '../src/core/observation';
import type { MemoryMark } from '../src/core/perceptionBuffer';
import { recordedPast } from '../src/core/storedAnimal';
import { isDry } from '../src/core/stages/surfaceAt';
import { PLAYABLES } from '../src/render/playables';

const MECH = 'Mech & Boitani 2003, Wolves: Behavior, Ecology and Conservation';
const DITCHKOFF = 'Ditchkoff 2011, in Biology and Management of White-tailed Deer';
const KREBS = 'Krebs et al. 2001';

test('wolf, deer and hare entry is a stored life inside the published lifespan', () => {
  const animals = livingRoster();
  const sources = { wolf: MECH, deer: DITCHKOFF, hare: KREBS } as const;
  for (const species of ['wolf', 'deer', 'hare'] as const) {
    const choice = enterLiving(animals, species, new Map());
    const life = LIFESPAN[species];
    assert.equal(choice.playableId, species);
    assert.equal(choice.animal.species, species);
    assert.equal(choice.animal.ageYears, life.startYears);
    assert.equal(ageInsideLifespan(species, choice.animal.ageYears), true);
    assert.ok(choice.animal.ageYears <= life.maxYears, sources[species]);
    assert.ok(recordedPast(choice.animal));
    assert.equal(isDry(choice.animal.x, choice.animal.z), true);
    assert.equal(choice.memories.length, 0);
  }
  const wolf = enterLiving(animals, 'wolf', new Map());
  const mate = animals.find(a => a.species === 'wolf' && a.handle !== wolf.animal.handle);
  assert.ok(mate);
  assert.equal(wolf.animal.territory, wolf.animal.handle);
  assert.notEqual(wolf.animal.handle, enterLiving(animals, 'hare', new Map()).animal.handle);
  assert.notEqual(wolf.animal.handle, enterLiving(animals, 'deer', new Map()).animal.handle);
});

test('the embodied id on the step 1 record equals the store id', () => {
  const wolf = enterLiving(livingRoster(), 'wolf', new Map());
  const saved = { ...OBSERVATION_SOURCES };
  registerObservationSources({ embodied: () => wolf.animal.handle });
  try {
    assert.equal(observationRecord().embodied, wolf.animal.handle);
    assert.notEqual(observationRecord().embodied, 'wolf');
  } finally { Object.assign(OBSERVATION_SOURCES, saved); }
});

test('a second entry of the same id keeps the memory marks', () => {
  const animals = livingRoster();
  const wolf = animals.find(a => a.species === 'wolf' && a.territory === a.handle);
  if (!wolf) throw new Error('no wolf');
  const marks: MemoryMark[] = [{ memoryType: 1, emotionType: 2, emotionalWeight: 0.5, x: wolf.x, y: 0, z: wolf.z }];
  const book = new Map<string, readonly MemoryMark[]>([[wolf.handle, marks]]);
  const first = enterLiving(animals, 'wolf', book);
  const again = enterLiving(animals, 'wolf', book, wolf.handle);
  assert.equal(again.animal.handle, first.animal.handle);
  assert.equal(again.memories, marks);
  assert.equal(again.memories, first.memories);
  assert.equal(again.memories[0].emotionalWeight, 0.5);
  assert.equal(again.animal.ageYears, first.animal.ageYears);
  assert.equal(again.animal.x, first.animal.x);
  assert.equal(again.animal.z, first.animal.z);
  assert.equal(book.get(wolf.handle), marks);
});

test('the page pack is the committed store dump, and the motor still creates from that life', () => {
  const file = readFileSync(new URL('./fixtures/stored-wolf-pack.bin', import.meta.url));
  assert.deepEqual(Buffer.from(LIVING_PACK), file);
  const wolf = enterLiving(livingRoster(), 'wolf', new Map());
  const motor = PLAYABLES.find(p => p.id === 'wolf');
  if (!motor) throw new Error('no wolf motor');
  const rig = motor.create(wolf.animal);
  assert.equal(rig.brain.stored?.handle, wolf.animal.handle);
  assert.equal(rig.brain.energy, wolf.animal.energy);
  assert.equal(WITNESS_ALTITUDE_SCALE, 2);
});

test('buildScene embodies the store handle and does not mint a blank create()', () => {
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  const motor = readFileSync(new URL('../src/render/playables.ts', import.meta.url), 'utf8');
  assert.match(scene, /enterLiving\(livingRoster\(\), 'wolf', memoryBook\)/);
  assert.match(scene, /current\.create\(choice\.animal\)/);
  assert.doesNotMatch(motor, /createDeerRig\(4242/);
  assert.doesNotMatch(motor, /new AnimalBrain\(11\)/);
  assert.doesNotMatch(motor, /new AnimalBrain\(7\)/);
});
