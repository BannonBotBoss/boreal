/**
 * Roadmap step 9. Quality is #101's sum. A grazed browse cell has less food than an ungrazed one.
 * Environmental stress is not a term (conflict 11). Nothing on screen, so the frame gate is the two cells.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browseCellKey, browseGrams, FORAGE_REFILL_DAYS, takePatch } from '../src/core/fields';
import { DELTAS } from '../src/core/deltas';
import { siteAt } from '../src/core/flora/site';
import {
  competitionShare, habitatAt, habitatCell, habitatQuality, harePeakOnCell, predatorShare, wolfCeilingOnCell,
} from '../src/core/habitat';
import { REAL_SECONDS_PER_GAME_HOUR } from '../src/core/timeOfDay';
import { weatherAt } from '../src/core/weather';
import { worldSec } from '../src/core/worldClock';

const ZERO = { herbivores: 0, wolves: 0 };
const X = 3, Z = 4;

test('quality is food + water + shelter − competition − predator pressure, and stress is not a term', () => {
  const full = { food: 1, water: 0.6, shelter: 0.8, vegetation: 1, competition: 0.2, predatorPressure: 0.1 };
  const hunted = { ...full, food: 0.35, vegetation: 0.35 };
  assert.equal(habitatQuality(full), 2.1);
  assert.equal(habitatCell(full).quality, 2.1);
  assert.ok(habitatQuality(hunted) < habitatQuality(full), 'the hunted fixture has less food and a lower score');
  assert.ok(Math.abs(habitatQuality(hunted) - 1.45) < 1e-12);
  // Same five terms. A stress number is not an argument, so two readings match.
  const again = habitatQuality({ food: full.food, water: full.water, shelter: full.shelter, vegetation: full.vegetation, competition: full.competition, predatorPressure: full.predatorPressure });
  assert.equal(again, habitatQuality(full));
  const src = readFileSync(new URL('../src/core/habitat.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export function habitatQuality'), src.indexOf('export function habitatCell'));
  assert.match(fn, /food \+ t\.water \+ t\.shelter - t\.competition - t\.predatorPressure/);
  assert.doesNotMatch(fn, /stress|snow|climateClass/);
});

test('one hare or one wolf on the browse cell saturates that term; half the hare peak is half', () => {
  const hares = harePeakOnCell();
  const wolves = wolfCeilingOnCell();
  assert.ok(Math.abs(hares - 0.064) < 1e-12, `hare peak on the 8 m cell is ${hares}`);
  assert.ok(Math.abs(wolves - 2.56e-6) < 1e-18, `wolf ceiling on the cell is ${wolves}`);
  assert.equal(competitionShare(0), 0);
  assert.equal(predatorShare(0), 0);
  assert.equal(competitionShare(hares / 2), 0.5);
  assert.equal(competitionShare(hares), 1);
  assert.equal(competitionShare(hares * 4), 1);
  assert.equal(predatorShare(wolves), 1);
  assert.equal(predatorShare(1), 1);
});

test('a grazed clearing has less food than the same cell ungrazed, and the score drops by that much', () => {
  const saved = DELTAS.log.slice();
  DELTAS.log.length = 0;
  try {
    const now = worldSec();
    const full = habitatAt(X, Z, ZERO, now);
    assert.ok(full.food > 0.99, `ungrazed food ${full.food}`);
    assert.equal(full.vegetation, full.food);
    assert.equal(full.competition, 0);
    assert.equal(full.predatorPressure, 0);
    const site = siteAt(X, Z, true, false);
    const expectWater = site.water ? 1 : Math.max(0, Math.min(1, weatherAt(X, Z).soil));
    assert.ok(Math.abs(full.water - expectWater) < 1e-9, `water ${full.water} vs ${expectWater}`);
    assert.ok(full.shelter >= 0 && full.shelter <= 1, `shelter ${full.shelter}`);
    const grams = browseGrams(X, Z);
    const eaten = takePatch({ key: browseCellKey(X, Z), x: X, z: Z, kind: 'browse', grams: grams / 2, by: 'deer:habitat' });
    assert.ok(eaten > 0);
    const grazed = habitatAt(X, Z, ZERO, now);
    assert.ok(grazed.food < full.food - 0.4, `grazed food ${grazed.food}`);
    assert.equal(grazed.vegetation, grazed.food);
    assert.equal(grazed.shelter, full.shelter);
    assert.ok(Math.abs((full.quality - grazed.quality) - (full.food - grazed.food)) < 1e-9);
    const crowded = habitatAt(X, Z, { herbivores: harePeakOnCell(), wolves: 1 }, now);
    assert.equal(crowded.food, grazed.food);
    assert.equal(crowded.competition, 1);
    assert.equal(crowded.predatorPressure, 1);
    assert.ok(Math.abs(crowded.quality - (grazed.quality - 2)) < 1e-9);
    const back = habitatAt(X, Z, ZERO, worldSec() + FORAGE_REFILL_DAYS * 24 * REAL_SECONDS_PER_GAME_HOUR * 4);
    assert.ok(back.food > grazed.food + 0.2, `regrew to ${back.food} from ${grazed.food}`);
    assert.equal(back.vegetation, back.food);
  } finally {
    DELTAS.log.length = 0;
    DELTAS.log.push(...saved);
  }
});

test('the habitat cell and the animal code do not read a climate-class string', () => {
  for (const file of ['src/core/habitat.ts', 'src/core/agent.ts', 'src/core/animalBehavior.ts']) {
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(text, /climateClass|temperate forest|Köppen|koppen|choose_action|fear > 90|habitat_score < 25/);
  }
});
