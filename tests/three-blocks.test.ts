/**
 * T-0105, roadmap step 19. Issues #102, #103, #105, #106. #106 wins.
 * The three blocks sit on the step 16 offsets. Hunger is not also an emotion.
 * Mating is an urge. The magnitudes are the step 10 weights. Frame gate is N/A.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { strongestUrge, urgeScores, urgeWeights } from '../src/core/agent';
import { physiologyOf } from '../src/core/bodyFeelings';
import { heatFactor } from '../src/core/needs/engine';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { PERCEPTION, readPerception, type Emotions, type Urges } from '../src/core/perceptionBuffer';
import { HARE_AGENT, WOLF_AGENT } from '../src/core/species';
import { feelingsOf, frameWithBlocks, threeBlocks, type DriveSeverity } from '../src/core/threeBlocks';

const src = readFileSync(new URL('../src/core/threeBlocks.ts', import.meta.url), 'utf8');

function f32s(bytes: Uint8Array, start: number, count: number): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(view.getFloat32(start + i * 4, true));
  return out;
}

const severity: DriveSeverity = {
  hunger: 1, thirst: 0, fatigue: 0, food: 1, water: 0, leave: 0,
};

test('hunger and thirst are the body, fear and curiosity are feelings, and mating is an urge', () => {
  const temperatureStress = heatFactor(WOLF_NEEDS, 30) - 1;
  assert.notEqual(temperatureStress, 0);
  const body = physiologyOf({
    energy: 80, water: 60, rest: 100, pain: 0, temperatureStress, oxygenStress: 0, stamina: 100,
  });
  assert.equal(body.hunger, 20);
  assert.equal(body.thirst, 40);
  const built = threeBlocks(HARE_AGENT.utility, body, { fear: 0.75, curiosity: 0.25 }, severity);
  const frame = frameWithBlocks(built);
  const read = readPerception(frame);
  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);

  assert.equal(PERCEPTION.physiologyOffset, 64);
  assert.equal(PERCEPTION.emotionOffset, 96);
  assert.equal(PERCEPTION.urgeOffset, 128);
  assert.equal(view.getFloat32(64, true), read.body.hunger);
  assert.equal(view.getFloat32(68, true), read.body.thirst);
  assert.equal(view.getFloat32(96, true), read.emotions.fear);
  assert.equal(view.getFloat32(108, true), read.emotions.curiosity);
  assert.equal(view.getFloat32(128, true), read.urges.feedDrive);
  assert.equal(view.getFloat32(144, true), read.urges.matingDrive);

  assert.equal(read.body.hunger, 20);
  assert.equal(read.body.thirst, 40);
  assert.equal(read.emotions.fear, 0.75);
  assert.equal(read.emotions.curiosity, 0.25);
  assert.equal(read.emotions.stress, 0);
  assert.equal(read.urges.matingDrive, 0);
  assert.equal(read.urges.safetyDrive, 0.75);

  const emotionKeys = Object.keys(read.emotions) as (keyof Emotions)[];
  const urgeKeys = Object.keys(read.urges) as (keyof Urges)[];
  assert.equal(emotionKeys.includes('hunger' as keyof Emotions), false);
  assert.equal(emotionKeys.includes('thirst' as keyof Emotions), false);
  assert.equal(emotionKeys.includes('matingDrive' as keyof Emotions), false);
  assert.equal(urgeKeys.includes('matingDrive'), true);
  assert.equal(urgeKeys.includes('hunger' as keyof Urges), false);

  const emotionFloats = f32s(frame, PERCEPTION.emotionOffset, 8);
  assert.equal(emotionFloats.includes(Math.fround(body.hunger)), false);
  assert.equal(emotionFloats.includes(Math.fround(body.thirst)), false);
  assert.equal(emotionFloats.includes(Math.fround(temperatureStress)), false);
  assert.notEqual(read.emotions.stress, read.body.temperatureStress);

  const omitted = threeBlocks(HARE_AGENT.utility, body, { fear: 0.75 }, severity);
  assert.equal(omitted.emotions.curiosity, 0);
  assert.deepEqual(omitted.scores, built.scores);
  assert.deepEqual(feelingsOf(0.75), { ...built.emotions, curiosity: 0 });
});

test('the urge magnitudes are the step 10 weights, and rest is not packed into mating', () => {
  const body = physiologyOf({
    energy: 80, water: 100, rest: 100, pain: 0, temperatureStress: 0, oxygenStress: 0, stamina: 100,
  });
  const hare = threeBlocks(HARE_AGENT.utility, body, { fear: 0.75, curiosity: 0.25 }, severity);
  const hareExpected = urgeScores(urgeWeights(HARE_AGENT.utility), { ...severity, fear: 0.75 });
  assert.deepEqual(hare.weights, urgeWeights(HARE_AGENT.utility));
  assert.deepEqual(hare.scores, hareExpected);
  assert.equal(hare.weights.feed, HARE_AGENT.utility.feedHere);
  assert.equal(hare.weights.drink, HARE_AGENT.utility.approach);
  assert.equal(hare.weights.flee, 1);
  assert.equal(hare.weights.move, HARE_AGENT.utility.seek);
  assert.equal(hare.urges.feedDrive, hareExpected.feed);
  assert.equal(hare.urges.drinkDrive, hareExpected.drink);
  assert.equal(hare.urges.safetyDrive, hareExpected.flee);
  assert.equal(hare.urges.explorationDrive, hareExpected.move);
  assert.notEqual(hare.urges.feedDrive, body.hunger);
  assert.equal(hare.winner, strongestUrge(hareExpected));
  assert.equal(hare.winner, 'flee');

  const wolfSeverity: DriveSeverity = { hunger: 1, thirst: 1, fatigue: 0, food: 1, water: 1, leave: 0 };
  const wolf = threeBlocks(WOLF_AGENT.utility, body, { fear: 0 }, wolfSeverity);
  const wolfExpected = urgeScores(urgeWeights(WOLF_AGENT.utility), { ...wolfSeverity, fear: 0 });
  assert.deepEqual(wolf.scores, wolfExpected);
  assert.equal(wolf.weights.drink, WOLF_AGENT.utility.investigate);
  assert.notEqual(wolf.scores.feed, hare.scores.feed);

  const tired = threeBlocks(
    HARE_AGENT.utility, body, { fear: 0 },
    { hunger: 0, thirst: 0, fatigue: 1, food: 1, water: 0, leave: 0 },
  );
  assert.equal(tired.winner, 'rest');
  assert.equal(tired.scores.rest, urgeScores(urgeWeights(HARE_AGENT.utility), {
    hunger: 0, thirst: 0, fear: 0, fatigue: 1, food: 1, water: 0, leave: 0,
  }).rest);
  assert.ok(tired.scores.rest > 0);
  const packed = f32s(frameWithBlocks(tired), PERCEPTION.urgeOffset, 8);
  assert.equal(packed.includes(Math.fround(tired.scores.rest)), false);
  assert.equal(tired.urges.matingDrive, 0);
  assert.equal(packed[4], 0);

  assert.match(src, /urgeWeights/);
  assert.match(src, /urgeScores/);
  assert.doesNotMatch(src, /choose_action|interface Mind|Instincts|feedHere/);
  assert.deepEqual(src.match(/matingDrive:\s*[^,\n]+/g), ['matingDrive: 0']);
  assert.doesNotMatch(src, /\b(90|80|25|85)\b/);
});
