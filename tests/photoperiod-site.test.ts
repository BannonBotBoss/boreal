import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { activityAt, chooseGoal, sunTimes } from '../src/core/needs/behaviour';
import { clearSite, setSite } from '../src/core/sitePhase';
import { createAnimal, createWorld, tick } from '../src/core/sim';
import { createNeeds, levelsOf } from '../src/core/needs/engine';

test('T-0172: sunTimes and chooseGoal follow landed siteLatitude across summer and winter solstices', () => {
  clearSite();
  try {
    // Home latitude (49.5°N), summer solstice day 172 (NOAA Spencer 1971 geometric sunrise ~3.9649 h, sunset ~20.0351 h):
    const homeSummer = sunTimes(172);
    assert.ok(Math.abs(homeSummer.sunrise - 3.9649) < 0.02);
    assert.ok(Math.abs(homeSummer.sunset - 20.0351) < 0.02);

    // Land at subarctic open woodland (64.5°N):
    setSite({
      latDeg: 64.5,
      lonDeg: -110,
      datumM: 280,
      salt: 42,
      dir: [0, 1, 0],
      east: [1, 0, 0],
      north: [0, 0, 1],
    });

    const subarcticSummer = sunTimes(172);
    assert.ok(Math.abs(subarcticSummer.sunrise - 1.6374) < 0.02);
    assert.ok(Math.abs(subarcticSummer.sunset - 22.3626) < 0.02);

    const subarcticWinter = sunTimes(355);
    assert.ok(Math.abs(subarcticWinter.sunrise - 10.3498) < 0.02);
    assert.ok(Math.abs(subarcticWinter.sunset - 13.6502) < 0.02);

    const levels = levelsOf({ ...createNeeds(), water: 95, rest: 80 }, 75);
    // At 21:49 (21.82 h) on summer solstice at 64.5°N (0.54 h before 22.36 h sunset), crepuscular wolf is active:
    const duskChoice = chooseGoal(WOLF_NEEDS, levels, { hour: 21.82, ...subarcticSummer });
    assert.equal(activityAt(WOLF_NEEDS, { hour: 21.82, ...subarcticSummer }), 1);
    assert.equal(duskChoice.goal, 'explore');

    // At 08:00 on winter solstice at 64.5°N (2.35 h before 10.35 h sunrise), crepuscular wolf rests:
    const winterNightChoice = chooseGoal(WOLF_NEEDS, levels, { hour: 8.0, ...subarcticWinter });
    assert.equal(activityAt(WOLF_NEEDS, { hour: 8.0, ...subarcticWinter }), WOLF_NEEDS.behaviour.activity.offPeak.v);
    assert.equal(winterNightChoice.goal, 'rest');
  } finally {
    clearSite();
  }
});

test('T-0172: headless SimWorld stepPredator uses seasonal and latitude-aware sunTimes instead of 6/18 equinox', () => {
  // 1. Summer solstice dawn at 49.5°N (day = 172, sunrise = 3.96 h, hour = 4.2 h): predator is active ('move', speed > 0),
  // whereas hardcoded { sunrise: 6, sunset: 18 } previously forced 'rest' (|4.2 - 6| = 1.8 h > 1.5 h).
  const summerDawnWorld = createWorld({
    seed: 7,
    hour: () => 4.2,
    day: () => 172,
    latitude: () => 49.5,
  });
  const dawnWolf = createAnimal(summerDawnWorld, 'wolf', { x: 0, z: 0 }, {
    energy: 75,
    needs: { ...createNeeds(), water: 95, rest: 80 },
  });
  dawnWolf.timer = 0;
  dawnWolf.state = 'move';
  tick(summerDawnWorld, summerDawnWorld.step);
  assert.equal(dawnWolf.state, 'move');
  assert.ok(dawnWolf.speed > 0);

  // 2. Subarctic winter night at 64.5°N (day = 355, sunrise = 10.35 h, hour = 6.2 h): predator rests ('rest', speed = 0),
  // whereas hardcoded { sunrise: 6, sunset: 18 } previously treated 6.2 h as dawn and forced movement.
  const winterNightWorld = createWorld({
    seed: 7,
    hour: () => 6.2,
    day: () => 355,
    latitude: () => 64.5,
  });
  const nightWolf = createAnimal(winterNightWorld, 'wolf', { x: 0, z: 0 }, {
    energy: 75,
    needs: { ...createNeeds(), water: 95, rest: 80 },
  });
  nightWolf.timer = 0;
  nightWolf.state = 'move';
  tick(winterNightWorld, winterNightWorld.step);
  assert.equal(nightWolf.state, 'rest');
  assert.equal(nightWolf.speed, 0);

  // 3. Static check that main.ts and animals/hare.ts propagate siteLatitude, dayAt, and hourAt.
  const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const hareSrc = readFileSync(new URL('../src/animals/hare.ts', import.meta.url), 'utf8');
  assert.match(mainSrc, /sunTimes\(dayAt\(wNow\),\s*siteLatitude\(LATITUDE\)\)/);
  assert.match(hareSrc, /world\.hour\s*=\s*\(\)\s*=>\s*hourAt\(worldSec\(\)\)/);
  assert.match(hareSrc, /world\.day\s*=\s*\(\)\s*=>\s*dayAt\(worldSec\(\)\)/);
  assert.match(hareSrc, /world\.latitude\s*=\s*\(\)\s*=>\s*siteLatitude\(LATITUDE\)/);
});
