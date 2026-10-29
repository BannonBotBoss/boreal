/**
 * T-0102, roadmap step 18. Issues #102, #103, #106.
 * Water and energy match stepNeeds. The physiology bytes match the step 16 block.
 * Weight is not stored. Frame gate is N/A until step 20.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ANIMAL_DEFAULT_ENERGY } from '../src/core/animalBehavior';
import {
  frameWithPhysiology, joinBodyRecords, packPhysiology, physiologyOf, readFeelingsFixture,
  readJoinedFixture, reserveFull, speciesCarrying, stepBodyFeelings, stepStamina,
  type StoredFeelings,
} from '../src/core/bodyFeelings';
import { LIFESPAN } from '../src/core/lifespan';
import { createNeeds, heatFactor, staminaRates, stepNeeds } from '../src/core/needs/engine';
import { HARE_NEEDS, WOLF_NEEDS } from '../src/core/needs/species';
import { PERCEPTION, readPerception } from '../src/core/perceptionBuffer';
import { readStoredFixture } from '../src/core/storedFixture';
import { createWolfModes, stepWolfModes } from '../src/core/wolfModes';
import { rigMass } from '../src/render/mass';
import { createPlayerWolf } from '../src/render/playerWolf';

const full = reserveFull();
const opening = (): StoredFeelings => ({
  stamina: full, pain: 0, health: full, temperatureC: 0, temperatureStress: 0, oxygenStress: 0,
});

function hasWeight(record: object) {
  return 'massKg' in record || 'bodyMass' in record || 'body_mass' in record;
}

function containsFloat(bytes: Uint8Array, value: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const want = Math.fround(value);
  for (let i = 0; i + 4 <= bytes.byteLength; i += 4) if (view.getFloat32(i, true) === want) return true;
  return false;
}

test('the store fixture joins reserves and feelings, and stores no weight', () => {
  const animals = readStoredFixture();
  const feelings = readFeelingsFixture();
  const records = joinBodyRecords(animals, feelings);
  assert.equal(records.length, animals.length);
  assert.equal(readJoinedFixture().length, animals.length);
  const wolves = records.filter(row => animals.find(animal => animal.handle === row.handle)?.species === 'wolf');
  const hares = records.filter(row => animals.find(animal => animal.handle === row.handle)?.species === 'hare');
  assert.equal(wolves.length, WOLF_NEEDS.social.groupSize.v[0]);
  assert.equal(hares.length, HARE_NEEDS.social.groupSize.v[0]);
  for (const wolf of wolves) {
    assert.equal(wolf.ageYears, LIFESPAN.wolf.startYears);
    assert.equal(wolf.energy, ANIMAL_DEFAULT_ENERGY);
    assert.equal(wolf.water, full);
    assert.equal(wolf.rest, full);
    assert.equal(wolf.stamina, full);
    assert.equal(wolf.pain, 0);
    assert.equal(wolf.health, full);
    assert.equal(wolf.temperatureC, 0);
    assert.equal(wolf.temperatureStress, 0);
    assert.equal(wolf.oxygenStress, 0);
    assert.equal(heatFactor(WOLF_NEEDS, wolf.temperatureC) - 1, 0);
    assert.equal(hasWeight(wolf), false);
  }
  assert.equal(hares[0].ageYears, LIFESPAN.hare.startYears);
  assert.equal(hares[0].energy, ANIMAL_DEFAULT_ENERGY);
  assert.equal(hasWeight(hares[0]), false);
  const src = readFileSync(new URL('../rust/boreal-sim/src/animals.rs', import.meta.url), 'utf8');
  assert.match(src, /"BodyFeelings"/);
  assert.doesNotMatch(src, /body_mass|BodyMass|massKg/);
});

test('water and energy match stepNeeds, including at the rig mass', () => {
  const wolf = createPlayerWolf(1400);
  const generated = rigMass(wolf.root, 'canid');
  wolf.root.scale.multiplyScalar(2);
  const doubled = rigMass(wolf.root, 'canid');
  assert.ok(Number.isFinite(generated) && generated > 0);
  assert.ok(Math.abs(doubled / generated - 8) < 1e-6, `${doubled} / ${generated}`);

  const needs = createNeeds();
  const energy = ANIMAL_DEFAULT_ENERGY;
  const walk = WOLF_NEEDS.body.speeds.walk.v;
  const tC = WOLF_NEEDS.needs.water.heatAboveC.v + 10;
  const base = { dtGame: 3600, dtReal: 1, speed: walk, tC, gait: 'walk' as const };
  const atRow = stepBodyFeelings(WOLF_NEEDS, needs, energy, opening(), LIFESPAN.wolf.startYears, { ...base, generatedKg: WOLF_NEEDS.body.massKg.v }, 'row');
  const directRow = stepNeeds(speciesCarrying(WOLF_NEEDS, WOLF_NEEDS.body.massKg.v), needs, { dtGame: base.dtGame, speed: walk, tC, energy });
  assert.equal(atRow.energy, directRow.energy);
  assert.equal(atRow.needs.water, directRow.state.water);
  assert.equal(atRow.needs.rest, directRow.state.rest);
  assert.equal(atRow.record.ageYears, LIFESPAN.wolf.startYears);
  assert.equal(atRow.feelings.pain, 0);
  assert.equal(atRow.feelings.health, full);
  assert.equal(atRow.feelings.oxygenStress, 0);
  assert.equal(atRow.feelings.temperatureC, tC);
  assert.equal(atRow.feelings.temperatureStress, heatFactor(WOLF_NEEDS, tC) - 1);
  assert.ok(atRow.feelings.temperatureStress > 0);
  assert.equal(atRow.physiology.hunger + atRow.energy, full);
  assert.equal(atRow.physiology.thirst + atRow.record.water, full);
  assert.equal(atRow.physiology.fatigue + atRow.record.rest, full);
  assert.equal(atRow.physiology.reserved, 0);
  assert.equal(hasWeight(atRow.record), false);

  const atBig = stepBodyFeelings(WOLF_NEEDS, needs, energy, opening(), LIFESPAN.wolf.startYears, { ...base, generatedKg: doubled }, 'big');
  const directBig = stepNeeds(speciesCarrying(WOLF_NEEDS, doubled), needs, { dtGame: base.dtGame, speed: walk, tC, energy });
  assert.equal(atBig.energy, directBig.energy);
  assert.equal(atBig.needs.water, directBig.state.water);
  assert.equal(atBig.needs.rest, directBig.state.rest);
  assert.notEqual(atBig.energy, atRow.energy);
  assert.equal(hasWeight(atBig.record), false);

  const atRig = stepBodyFeelings(WOLF_NEEDS, needs, energy, opening(), LIFESPAN.wolf.startYears, { ...base, generatedKg: generated }, 'rig');
  const directRig = stepNeeds(speciesCarrying(WOLF_NEEDS, generated), needs, { dtGame: base.dtGame, speed: walk, tC, energy });
  assert.equal(atRig.energy, directRig.energy);
  assert.equal(atRig.needs.water, directRig.state.water);

  const hareNeeds = createNeeds();
  const hare = stepBodyFeelings(HARE_NEEDS, hareNeeds, energy, opening(), LIFESPAN.hare.startYears, {
    dtGame: 600, dtReal: 0.5, speed: HARE_NEEDS.body.speeds.walk.v, tC: HARE_NEEDS.needs.water.heatAboveC.v, gait: 'still', generatedKg: generated,
  });
  const hareDirect = stepNeeds(speciesCarrying(HARE_NEEDS, generated), hareNeeds, {
    dtGame: 600, speed: HARE_NEEDS.body.speeds.walk.v, tC: HARE_NEEDS.needs.water.heatAboveC.v, energy,
  });
  assert.equal(hare.energy, hareDirect.energy);
  assert.equal(hare.needs.water, hareDirect.state.water);
  assert.equal(hare.feelings.temperatureStress, 0);

  const thirsty = createNeeds({ water: 40 });
  const drink = stepBodyFeelings(WOLF_NEEDS, thirsty, energy, opening(), LIFESPAN.wolf.startYears, {
    ...base, speed: 0, gait: 'still', drinking: true, dtGame: 10, generatedKg: WOLF_NEEDS.body.massKg.v,
  });
  const drinkDirect = stepNeeds(speciesCarrying(WOLF_NEEDS, WOLF_NEEDS.body.massKg.v), thirsty, {
    dtGame: 10, speed: 0, tC, drinking: true, energy,
  });
  assert.equal(drink.needs.water, drinkDirect.state.water);
  assert.ok(drink.needs.water > thirsty.water);

  assert.throws(() => stepBodyFeelings(WOLF_NEEDS, needs, energy, opening(), LIFESPAN.wolf.startYears, { ...base, generatedKg: 0 }));
});

test('stamina uses staminaRates the way the wolf modes already do', () => {
  const rates = staminaRates(WOLF_NEEDS);
  const start = { ...createWolfModes(), stamina: 50 };
  const run = stepWolfModes(start, 0, 1, true, 1, rates);
  assert.equal(run.mode, 'run');
  assert.equal(stepStamina(WOLF_NEEDS, 50, 'run', 1), run.stamina);
  const walk = stepWolfModes(start, 0, 0, true, 1, rates);
  assert.equal(walk.mode, 'walk');
  assert.equal(stepStamina(WOLF_NEEDS, 50, 'walk', 1), walk.stamina);
  const sprintStart = { ...createWolfModes(), stamina: 50, first: 'right' as const, left: true, right: true };
  const sprint = stepWolfModes(sprintStart, 1, 1, true, 1, rates);
  assert.equal(sprint.mode, 'sprint');
  assert.equal(stepStamina(WOLF_NEEDS, 50, 'sprint', 1), sprint.stamina);
  assert.equal(stepStamina(WOLF_NEEDS, 50, 'sprint', 1), 50 - rates.sprint);
});

test('the physiology block slots in at the step 16 offset and does not carry weight, age, or health', () => {
  const block = physiologyOf({
    energy: 80, water: 70, rest: 60, pain: 0, temperatureStress: heatFactor(WOLF_NEEDS, 30) - 1, oxygenStress: 0, stamina: 40,
  });
  const packed = packPhysiology(block);
  assert.equal(packed.byteLength, PERCEPTION.physiologyBytes);
  assert.equal(packed.byteLength, 32);
  assert.equal(block.hunger, full - 80);
  assert.equal(block.thirst, full - 70);
  assert.equal(block.fatigue, full - 60);
  assert.equal(block.reserved, 0);
  const healthStandIn = 17.5;
  const ageStandIn = 9.25;
  assert.equal(containsFloat(packed, healthStandIn), false);
  assert.equal(containsFloat(packed, ageStandIn), false);
  const frame = frameWithPhysiology(block);
  const read = readPerception(frame);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  assert.equal(PERCEPTION.physiologyOffset, 64);
  assert.equal(read.body.hunger, view.getFloat32(64, true));
  assert.equal(read.body.thirst, view.getFloat32(68, true));
  assert.equal(read.body.fatigue, view.getFloat32(72, true));
  assert.equal(read.body.pain, view.getFloat32(76, true));
  assert.equal(read.body.temperatureStress, view.getFloat32(80, true));
  assert.equal(read.body.oxygenStress, view.getFloat32(84, true));
  assert.equal(read.body.stamina, view.getFloat32(88, true));
  assert.equal(read.body.reserved, 0);
  assert.equal(view.getFloat32(92, true), 0);
  assert.equal(read.emotions.stress, 0);
  assert.equal(read.emotions.fear, 0);
  assert.equal(read.urges.feedDrive, 0);
});
