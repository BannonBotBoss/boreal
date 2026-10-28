import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimalBrain, ANIMAL_DEFAULT_ENERGY } from '../src/core/animalBehavior';
import { LIFESPAN } from '../src/core/lifespan';
import { HARE_NEEDS, WOLF_NEEDS } from '../src/core/needs/species';
import { mammalSkeleton } from '../src/core/species';
import { validateSkeleton } from '../src/core/skeleton';
import { mirrorStoredAnimal, packRequest, recordedPast, STORED_ARCHETYPE, STORED_SPECIES } from '../src/core/storedAnimal';
import { readStoredFixture } from '../src/core/storedFixture';
import { dryStart } from '../src/core/stages/surfaceAt';

const origin = { x: 0, y: 0, z: 0 };

test('wolf pack request uses the species rows', () => {
  const pack = packRequest('wolf', origin);
  const [lo, hi] = WOLF_NEEDS.social.groupSize.v;
  assert.equal(pack.ageYears, LIFESPAN.wolf.startYears);
  assert.ok(pack.ageYears > 0);
  assert.equal(pack.count, lo);
  assert.ok(pack.count >= lo && pack.count <= hi);
  assert.equal(pack.spacingM, WOLF_NEEDS.social.spacingM.v);
  assert.equal(pack.speciesCode, STORED_SPECIES.wolf);
  assert.equal(pack.archetype, 'canid');
  assert.equal(pack.archetypeCode, STORED_ARCHETYPE.canid);
  assert.equal(pack.founder, true);
  assert.equal(pack.energy, ANIMAL_DEFAULT_ENERGY);
  assert.equal(pack.water, 100);
  assert.equal(pack.rest, 100);
  assert.equal(pack.places.length, lo);
  assert.equal(pack.places[1].x, pack.spacingM);
  assert.equal(validateSkeleton(mammalSkeleton('Gray Wolf')).length, 0);
  assert.equal('massKg' in pack, false);
  assert.equal('bodyMass' in pack, false);
});

test('hare request uses the hare row and stays one animal', () => {
  const pack = packRequest('hare', origin);
  const [lo, hi] = HARE_NEEDS.social.groupSize.v;
  assert.equal(pack.ageYears, LIFESPAN.hare.startYears);
  assert.equal(pack.count, lo);
  assert.ok(pack.count >= lo && pack.count <= hi);
  assert.equal(pack.spacingM, HARE_NEEDS.social.spacingM.v);
  assert.equal(pack.archetype, 'leporid');
  assert.equal(pack.speciesCode, STORED_SPECIES.hare);
  assert.equal(validateSkeleton(mammalSkeleton('Snowshoe Hare')).length, 0);
});

test('the store fixture is that wolf, with a founder flag and no weight field', () => {
  const animals = readStoredFixture();
  const wolves = animals.filter(a => a.species === 'wolf');
  const hare = animals.filter(a => a.species === 'hare');
  const want = packRequest('wolf', origin);
  assert.equal(wolves.length, want.count);
  for (const wolf of wolves) {
    assert.equal(wolf.ageYears, want.ageYears);
    assert.ok(recordedPast(wolf));
    assert.equal(wolf.founder, true);
    assert.equal(wolf.parent, null);
    assert.equal(wolf.archetype, 'canid');
    assert.equal(wolf.water, want.water);
    assert.equal(wolf.energy, want.energy);
    assert.equal(wolf.rest, want.rest);
    assert.equal(wolf.territory, wolves[0].handle);
    assert.equal('massKg' in wolf, false);
    assert.equal('bodyMass' in wolf, false);
  }
  const [standX, standZ] = dryStart(0, 0);
  assert.equal(wolves[0].x, standX);
  assert.equal(wolves[1].x, standX + want.spacingM);
  assert.equal(wolves[0].y, 0);
  assert.equal(wolves[0].z, standZ);
  const hareWant = packRequest('hare', origin);
  assert.equal(hare.length, hareWant.count);
  assert.equal(hare[0].ageYears, hareWant.ageYears);
  assert.equal(hare[0].founder, true);
  assert.ok(recordedPast(hare[0]));
  assert.equal(hare[0].archetype, 'leporid');
  assert.notEqual(hare[0].handle, wolves[0].handle);
  assert.equal(hare[0].x, standX + hareWant.spacingM);
  assert.equal(hare[0].z, standZ);
  const deer = animals.filter(a => a.species === 'deer');
  const deerWant = packRequest('deer', origin);
  assert.equal(deer.length, deerWant.count);
  assert.equal(deer[0].ageYears, deerWant.ageYears);
  assert.equal(deer[0].founder, true);
  assert.ok(recordedPast(deer[0]));
  assert.equal(deer[0].archetype, 'cervid');
  assert.equal(deer[0].x, standX);
  assert.equal(deer[0].z, standZ + hareWant.spacingM);
  assert.equal(validateSkeleton(mammalSkeleton('White-tailed Deer')).length, 0);
});

test('AnimalBrain mirrors the stored wolf and is not a second list', () => {
  const wolf = readStoredFixture().find(a => a.species === 'wolf');
  if (!wolf) throw new Error('fixture has no wolf');
  const brain = new AnimalBrain(1);
  assert.equal(brain.stored === undefined, true);
  mirrorStoredAnimal(brain, wolf);
  const mirrored = brain.stored;
  if (!mirrored) throw new Error('mirror did not land');
  assert.equal(brain.energy, wolf.energy);
  assert.equal(mirrored.ageYears, wolf.ageYears);
  assert.equal(mirrored.founder, true);
  assert.equal(mirrored.handle, wolf.handle);
  assert.equal(mirrored.parent, null);
  brain.decide({ x: 0, y: 0, z: 0 }, 0.016);
  assert.equal(brain.stored?.ageYears, wolf.ageYears);
  assert.equal(brain.stored?.energy, wolf.energy);
  assert.equal(brain.stored?.founder, true);
});

test('the animal module does not declare a weight component', () => {
  const src = readFileSync(new URL('../rust/boreal-sim/src/animals.rs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /body_mass|BodyMass|massKg/);
  assert.match(src, /COMPONENT_NAMES/);
  assert.match(src, /"Kinship"/);
  assert.match(src, /"Territory"/);
});
