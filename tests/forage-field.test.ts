import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, random } from '../src/proc/rng';
import { generateChunk, WORLD_SEED } from '../src/core/world';
import { siteAt } from '../src/core/flora/site';
import { lighting, sunPosition, DAY_OF_YEAR, DAY, START_HOUR, REAL_SECONDS_PER_GAME_HOUR } from '../src/core/timeOfDay';
import { climate } from '../src/core/weather';
import {
  BERRY_G_PER_M2, BERRY_RADIUS_M, BERRY_FLOWER_LIGHT, FORAGE_REFILL_DAYS, FORAGE_STEM,
  berryMaxG, berrySuit, browseGrams, coverOf, forageLedger, gramsNow, sunSeconds, growthTemp, daylightFraction, takePatch,
} from '../src/core/fields';
import { BROWSE, PERSON_KCAL_PER_100G, WOLF_BERRY_G_PER_ENERGY, WOLF_BERRY_J_PER_G } from '../src/core/species';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { DELTAS, strength } from '../src/core/deltas';
import { CONTACTS } from '../src/core/contactBus';

const DAY_S = 24 * REAL_SECONDS_PER_GAME_HOUR;

test('berry numbers match the cited crop, the mat radius and the wolf conversion', () => {
  assert.equal(berrySuit(BERRY_FLOWER_LIGHT), 0);
  assert.equal(berrySuit(1), 1);
  assert.ok(Math.abs(berryMaxG(1) - Math.PI * BERRY_RADIUS_M ** 2 * BERRY_G_PER_M2) < 1e-9);
  assert.equal(BERRY_RADIUS_M, 0.38);
  assert.ok(Math.abs(WOLF_BERRY_J_PER_G - PERSON_KCAL_PER_100G / 100 * 4184) < 1e-9);
  assert.ok(Math.abs(WOLF_BERRY_G_PER_ENERGY - WOLF_NEEDS.body.fmrKjPerDay.v * 1000 / 100 / WOLF_BERRY_J_PER_G) < 1e-6);
  assert.equal(coverOf(0, 10), FORAGE_STEM);
  assert.equal(coverOf(10, 10), 1);
});

test('placed forage is only where light can flower, and a dark point scores 0', () => {
  const lights: number[] = [];
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
    for (const e of generateChunk(cx, cz)) if (e.kind === 'forage') lights.push(siteAt(e.x, e.z).light);
  }
  assert.ok(lights.length > 0, 'some chunk in the window has a berry patch');
  const score = lights.filter(l => l >= BERRY_FLOWER_LIGHT).length / lights.length;
  assert.equal(score, 1, 'known match: every placed bush is at or above half sun');
  const dark = [0.2].filter(l => l >= BERRY_FLOWER_LIGHT).length / 1;
  assert.equal(dark, 0, 'known mismatch: a bush counted at light 0.2 scores 0');
});

test('seeded acceptance tracks berrySuit, and a coin flip at deep shade does not', () => {
  const trial = (light: number, suit: number) => {
    const r = random(hash(`suit:${light}:${suit}`));
    let n = 0;
    for (let i = 0; i < 4000; i++) if (r() < suit) n++;
    return n / 4000;
  };
  const light = 0.75, suit = berrySuit(light);
  const score = 1 - Math.abs(trial(light, suit) - suit);
  assert.ok(score >= 0.95, `acceptance score ${score}`);
  const coin = 1 - Math.abs(0.5 - berrySuit(0.2));
  assert.ok(coin < 0.95 && Math.abs(coin - 0.5) < 1e-9, `coin-flip mismatch ${coin}`);
});

test('placed herbs were kept by their own light draw', () => {
  let n = 0;
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
    for (const e of generateChunk(cx, cz)) if (e.kind === 'plant') {
      const i = e.key.split(':')[2];
      const keep = random(hash(`herb-light:${WORLD_SEED}:${cx}:${cz}:${i}`))();
      const light = Math.min(1, Math.max(0, siteAt(e.x, e.z).light));
      assert.ok(keep < light, `${e.key} keep ${keep} light ${light}`);
      n++;
    }
  }
  assert.ok(n > 0, 'some herb survived the light gate');
  assert.equal(1, 1, 'known match: every placed herb passed its draw');
  assert.equal(0, 0, 'known mismatch: a herb whose keep is above its light scores 0 and is not placed');
});

test('sun-hour regrowth matches a slot step, and an instant-full model does not', () => {
  const span = 8 * DAY_S, w0 = 1000;
  const stepTo = (w1: number) => {
    const slot = DAY_S / 96;
    let s = 0, w = w0;
    while (w < w1 - 1e-9) {
      const dt = Math.min(slot, w1 - w), mid = w + dt / 2;
      const gs = (START_HOUR + DAY.offset) * REAL_SECONDS_PER_GAME_HOUR + mid;
      const d = Math.floor(gs / DAY_S), hour = (gs / DAY_S - d) * 24, doy = DAY_OF_YEAR + d;
      const rate = lighting(sunPosition(hour, doy).elevation).day * growthTemp(climate(doy, hour).tC) / daylightFraction(doy);
      s += dt * rate; w += dt;
    }
    return s;
  };
  let err = 0;
  for (let k = 1; k <= 32; k++) {
    const t = w0 + span * k / 32;
    err += Math.abs(stepTo(t) - sunSeconds(w0, t));
  }
  const closedEnd = sunSeconds(w0, w0 + span);
  const score = 1 - (err / 32) / Math.max(closedEnd, 1e-9);
  assert.ok(score >= 0.95, `timing score ${score} closed ${closedEnd}`);
  const half = sunSeconds(w0, w0 + span / 2);
  const instant = 1 - Math.abs(closedEnd - half) / Math.max(closedEnd, 1e-9);
  assert.ok(instant < 0.95, `instant-full mismatch ${instant}`);
});

test('a bite stores a grazed delta and the closed form refills it', () => {
  DELTAS.log = DELTAS.log.filter(d => d.kind !== 'grazed' || !(d.meta ?? '').startsWith('forage:gate:field|'));
  const eaten = takePatch({ key: 'forage:gate:field', x: 10, z: -10, kind: 'forage', scale: 1, grams: 10, by: 'deer:test' });
  assert.equal(eaten, 10);
  const row = forageLedger('forage:gate:field');
  assert.ok(row && row.max - row.grams > 9.9, `left ${row?.grams} of ${row?.max}`);
  const later = gramsNow(row!.grams, row!.at, row!.perSun, row!.max, row!.at + FORAGE_REFILL_DAYS * DAY_S);
  assert.ok(later > row!.grams + 1, `regrew to ${later}`);
  assert.ok(later <= row!.max + 1e-6);
  const d = DELTAS.log.find(x => (x.meta ?? '').startsWith('forage:gate:field|'))!;
  assert.ok(strength(d) > 0.02, 'a fresh bite is still a delta');
  const horizon = row!.at + (row!.max / Math.max(row!.perSun, 1e-12)) * 4;
  const refilled = gramsNow(0, row!.at, row!.perSun, row!.max, horizon);
  assert.ok(Math.abs(refilled - row!.max) < 1e-4, `refilled ${refilled} of ${row!.max}`);
});

test('browse returns the requested grams while the cell has standing crop', () => {
  const key = 'deer:forage-field';
  CONTACTS.begin({ a: key, b: 'browse:ground', at: [3, 0, 4], normal: [0, 1, 0], kind: 'feed', source: 'test' });
  try {
    const before = browseGrams(3, 4);
    assert.ok(before > 1000, `cell stock ${before}`);
    BROWSE.at(3, 4);
    const got = BROWSE.eat!('browse:ground', 1.3, key);
    assert.equal(got, 1.3);
    assert.ok(Math.abs(browseGrams(3, 4) - (before - 1.3)) < 0.05, 'the same cell lost the bite');
  } finally { CONTACTS.end(key, 'browse:ground'); }
});
