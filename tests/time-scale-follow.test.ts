/**
 * T-0106, roadmap step 32. Animals, the weather grid, and the ground follow the
 * observation signal that is already on the clock. No second list of scales.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markFor } from '../src/core/coarse';
import { column } from '../src/core/ground';
import { heightAt } from '../src/core/world';
import { LEVEL } from '../src/core/tuning';
import {
  SCALE_BOUNDS, aggregateShare, aggregateWorldSec, groundWorldSec, loadClock, observation,
  resolveObservation, setClockRate, simWorldSec,
} from '../src/core/worldClock';
import {
  WEATHER, climatologicalSweMm, initWeather, updateWeather, weatherAt,
} from '../src/core/weather';
import { DENSITY_TINT, densityTintGate, groundMarkOpacity, groundMarkRadius } from '../src/render/animalDensity';

function dryCell() {
  for (let x = -80; x <= 160; x += 16) for (let z = -80; z <= 160; z += 16) {
    if (heightAt(x, z) >= LEVEL.waterSurface + 0.4) return { x, z };
  }
  return { x: 0, z: 0 };
}

test('the forward second splits on the existing bands and does not flicker the label', () => {
  assert.equal(SCALE_BOUNDS[0].exit, 8);
  assert.equal(SCALE_BOUNDS[0].enter, 12);
  assert.equal(SCALE_BOUNDS[1].exit, 800);
  assert.equal(SCALE_BOUNDS[1].enter, 1200);
  assert.equal(SCALE_BOUNDS[2].exit, 8e4);
  assert.equal(SCALE_BOUNDS[2].enter, 1.2e5);
  loadClock(null, 0, 0);
  setClockRate(1, 0);
  assert.equal(observation().scale, 'immediate');
  assert.equal(simWorldSec(4), 4);
  assert.equal(aggregateWorldSec(4), 0);
  assert.equal(groundWorldSec(4), 4);
  setClockRate(10, 0);
  const mid = observation();
  assert.equal(mid.scale, 'immediate', '10× has not crossed the enter band');
  const body = simWorldSec(4, mid), field = aggregateWorldSec(4, mid);
  assert.ok(body > 0 && field > 0, 'inside the overlap both shares are alive');
  assert.ok(Math.abs(body + field - 4) < 1e-9, 'the shares are one forward second');
  setClockRate(9, 0);
  assert.equal(observation().scale, 'immediate');
  const low = aggregateShare(observation());
  setClockRate(11, 0);
  assert.equal(observation().scale, 'immediate', 'a wobble inside 8×–12× does not flip the label');
  assert.ok(aggregateShare(observation()) > low);
  setClockRate(20, 0);
  assert.equal(observation().scale, 'behavioral');
  assert.equal(simWorldSec(5), 0);
  assert.equal(aggregateWorldSec(5), 5);
  setClockRate(1e6, 0);
  assert.notEqual(observation().scale, 'immediate');
  assert.equal(simWorldSec(5), 0, 'individuals do not step a seasonal gap');
  assert.equal(aggregateWorldSec(5), 5, 'the coarse response is the forward second');
  assert.equal(aggregateWorldSec(-3), 0);
  assert.equal(groundWorldSec(-3), 0);
  assert.equal(groundWorldSec(4), 4);
  const clock = readFileSync(new URL('../src/core/worldClock.ts', import.meta.url), 'utf8');
  assert.equal((clock.match(/OBSERVATION_SCALES =/g) ?? []).length, 1);
  loadClock(null, 0, 0);
});

test('weather and the ground snow follow that share, and slowing down keeps the season', () => {
  const july = climatologicalSweMm(200);
  const january = climatologicalSweMm(15);
  assert.ok(july < 1, `midsummer snow-water ${july} mm`);
  assert.ok(january > 20 && january < 500, `midwinter snow-water ${january} mm is one season, not a geological pile`);
  assert.ok(january > july);
  const spot = dryCell();
  initWeather(200, 14, spot.x, spot.z, 4);
  loadClock(null, 0, 0);
  setClockRate(1, 0);
  WEATHER.day = 200;
  const summer = weatherAt(spot.x, spot.z);
  assert.ok(summer.sweMm < 1, `immediate summer store ${summer.sweMm}`);
  setClockRate(1e6, 0);
  WEATHER.day = 15;
  const winter = weatherAt(spot.x, spot.z);
  assert.ok(winter.sweMm > summer.sweMm + 10, `seasonal read ${winter.sweMm} vs held cell ${summer.sweMm}`);
  assert.ok(winter.depthCm > 5);
  const snow = column(spot.x, spot.z).layers.find(l => l.id === 'snow');
  assert.ok(snow && snow.thickness > 0.02, `ground snow ${snow?.thickness} m`);
  updateWeather(0, 12, 15, 12, 7200);
  setClockRate(1, 0);
  const kept = weatherAt(spot.x, spot.z);
  assert.ok(kept.sweMm > 10, `back on Immediate the cell kept the winter store ${kept.sweMm}`);
  loadClock(null, 0, 0);
});

test('the density drawing is on before the body is gone, and the standing sprite stays off', () => {
  const gate = densityTintGate(1.05, 0.95);
  assert.equal(gate, 0, 'wolf height does not open the camera-facing sprite');
  const fading = markFor(8, resolveObservation('immediate', 10));
  assert.ok(fading.body > 0 && fading.ink > 0, 'inside 8×–12× the body is still up and the density is already counted');
  assert.equal(fading.order[0], 'density');
  const patch = groundMarkOpacity(fading.ink, gate);
  assert.ok(patch > 0.2, `the ground patch is visible during the blend (${patch})`);
  assert.equal(groundMarkOpacity(0, gate), 0);
  const high = densityTintGate(DENSITY_TINT.riseFullM, 0.95);
  assert.ok(high > 0.9);
  assert.equal(groundMarkOpacity(1, high), 0, 'the high stain replaces the patch');
  assert.ok(groundMarkRadius('herd') < 8, 'the herd patch is not a clearing-sized lid');
  assert.ok(groundMarkRadius('herd') > 0.5);
  const density = readFileSync(new URL('../src/render/animalDensity.ts', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/render/buildScene.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const weather = readFileSync(new URL('../src/core/weather.ts', import.meta.url), 'utf8');
  assert.equal(density.includes('TIME_LEVELS'), false);
  assert.match(density, /gl_PointCoord/);
  assert.match(main, /aggregateWorldSec\(wDt, obs\)/);
  assert.match(main, /observation\(\)/);
  assert.match(weather, /aggregateShare\(observation\(\)\)/);
  assert.match(scene, /observation\(\)/);
  const syncAt = scene.indexOf('density.sync(');
  const bodyAt = scene.indexOf('setBodyShare(');
  assert.ok(syncAt > 0 && bodyAt > syncAt);
});
