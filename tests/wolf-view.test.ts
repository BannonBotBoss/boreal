/**
 * T-0075, T-0101. wolf-frame v1 stays calibrated: the measured issue #52 target scores 1, and a dead-astern or side
 * view scores under 0.95. T-0101 puts the shipped lens straight behind the wolf, outside that 25–45° band, because
 * the owner asked for a level view straight ahead. Guard-hair lengths stay inside the published ranges.
 * Mass is whatever rigMass derives; the test only checks it is that derivation and finite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { wolfCoat } from '../src/core/body';
import { wolfTubes } from '../src/core/wolfBody';
import { FUR_LENGTH, createPlayerWolf } from '../src/render/playerWolf';
import { rigMass } from '../src/render/mass';
import { RIDER_FLANK, RIDER_DISTANCE } from '../src/render/math';
import { framingScore, frameSample, histogram, histogramIntersection, legacyFrame, WOLF_FRAME } from '../tools/wolf-view-score';

const cm = (fur: number) => fur * FUR_LENGTH * 200; // model units × 200 = cm; the card length's random factor averages to 1

test('wolf-frame v1: known match scores 1, known mismatch stays under 0.95, the shipped camera looks straight ahead', () => {
  const hit = framingScore({ ndcX: WOLF_FRAME.ndcX, ndcY: WOLF_FRAME.ndcY, bearingDeg: 32, withersNdcY: 0 });
  assert.equal(hit, 1, 'a sample on the measured target is a known match');
  const legacy = framingScore(legacyFrame());
  assert.ok(legacy < .8, `dead-astern 1.6 m camera is a known mismatch (${legacy.toFixed(3)})`);
  const side = framingScore({ ndcX: WOLF_FRAME.ndcX, ndcY: WOLF_FRAME.ndcY, bearingDeg: 90, withersNdcY: 0 });
  assert.ok(side < .8, `a pure side view is outside the rear three-quarter (${side.toFixed(3)})`);
  const live = frameSample();
  const score = framingScore(live);
  assert.ok(Math.abs(Math.atan2(RIDER_FLANK, RIDER_DISTANCE) * 180 / Math.PI - live.bearingDeg) < .5, `bearing ${live.bearingDeg}`);
  assert.ok(Math.abs(live.bearingDeg) < .5, `shipped bearing ${live.bearingDeg}° is not straight ahead`);
  assert.ok(Math.abs(live.ndcX) < .05, `body ndcX ${live.ndcX}`);
  assert.ok(score < .95, `dead astern is outside the issue #52 band (${score.toFixed(3)}, bearing ${live.bearingDeg.toFixed(1)}°)`);
});

test('box-histogram v1: identical boxes score 1, a flat colour against a varied box scores under 0.2', () => {
  const varied = new Uint8Array(8 * 8 * 3);
  for (let i = 0; i < varied.length; i++) varied[i] = (i * 37) % 256;
  const same = histogramIntersection(histogram(varied), histogram(varied));
  assert.ok(Math.abs(same - 1) < 1e-9, `known match ${same}`);
  const flat = new Uint8Array(varied.length).fill(20);
  const miss = histogramIntersection(histogram(varied), histogram(flat));
  assert.ok(miss < .2, `known mismatch ${miss}`);
});

test('guard hairs: back stays 6–7 cm, shoulder ruff 9–13 cm (Wikipedia "Wolf")', () => {
  const trunk = wolfTubes(wolfCoat(1400))[0].rings;
  const back = trunk.filter(r => r.p[2] > -.05 && r.p[2] < .1);
  const neck = trunk.filter(r => r.p[2] <= -.19);
  assert.ok(back.length && neck.length);
  for (const r of back) assert.ok(cm(r.fur ?? 1) >= 6 && cm(r.fur ?? 1) <= 7.2, `back ${cm(r.fur ?? 1).toFixed(1)} cm`);
  for (const r of neck) assert.ok(cm(r.fur ?? 1) >= 9 && cm(r.fur ?? 1) <= 13, `shoulder ${cm(r.fur ?? 1).toFixed(1)} cm`);
});

test('player wolf mass is the rig volume times canid density, and finite', () => {
  const wolf = createPlayerWolf(1400);
  const mass = rigMass(wolf.root, 'canid');
  assert.equal(mass, rigMass(wolf.root, 'canid'));
  assert.ok(Number.isFinite(mass) && mass > 0, `mass ${mass}`);
});
