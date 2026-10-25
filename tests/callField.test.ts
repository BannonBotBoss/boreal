/**
 * T-0017 call field. Timing and position are scored here, not by eye.
 * timingScore = 1 - |mean interval - expected| / expected. positionScore = fraction of callers whose habitat matches the kind.
 * A known match must score at least 0.95. A known mismatch (every other call, or loons moved onto land) must score below 0.7.
 * The expected loon gap is recomputed from 166.8 and 9.3 and from sunPosition. It does not call callGap.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CALLERS, PANT_HZ, callGap, callTimes, callersInCell, callersNear, habitatOf, mealChews, pantGap, shouldPant, type Caller, type Habitat } from '../src/core/callField';
import { DAY_OF_YEAR, sunPosition } from '../src/core/timeOfDay';
import { WORLD_SEED } from '../src/core/world';
import { surfaceAt } from '../src/core/stages/surfaceAt';
import { standAt } from '../src/core/stand';
import { modeSpeed } from '../src/core/wolfModes';
import { MIX, deerSoundIds } from '../src/audio/borealSound';
import { CULL_DISTANCE } from '../src/audio/mixer';
import { chooseLine } from '../src/audio/wolfVoice';

const DAY = 227;
const lake = (areaHa: number): Habitat => ({ lake: true, areaHa, land: false, canopy: 0 });
const forest: Habitat = { lake: false, areaHa: 0, land: true, canopy: 0.8 };
const bare: Habitat = { lake: false, areaHa: 0, land: true, canopy: 0 };
const cellHa = 64 * 64 / 10000;

/** Published gap. Night is solar elevation < 0. Counts are Mennill's means, not the game's function. */
function publishedGap(kind: 'loon' | 'woodpecker', hour: number, day = DAY) {
  let nightH = 0;
  for (let h = 0; h < 24; h++) if (sunPosition(h + 0.5, day).elevation < 0) nightH++;
  const night = sunPosition(hour, day).elevation < 0;
  if (kind === 'loon') return (night ? nightH : 24 - nightH) * 3600 / (night ? 166.8 : 9.3);
  return night ? Infinity : 15;
}
function timingScore(times: number[], expected: number) {
  if (times.length < 2 || !(expected > 0) || !Number.isFinite(expected)) return 0;
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += times[i]! - times[i - 1]!;
  return 1 - Math.abs(sum / (times.length - 1) - expected) / expected;
}
function positionScore(callers: Caller[], habitatAt: (x: number, z: number) => Habitat) {
  if (!callers.length) return 0;
  let ok = 0;
  for (const c of callers) {
    const h = habitatAt(c.x, c.z);
    if (c.kind === 'loon' && h.lake && h.areaHa >= 2 && Number.isFinite(h.areaHa)) ok++;
    else if (c.kind === 'woodpecker' && h.land && h.canopy > 0 && !h.lake) ok++;
  }
  return ok / callers.length;
}
function collect(n: number, habitatAt: (x: number, z: number) => Habitat, seed = 7) {
  const out: Caller[] = [];
  const side = Math.ceil(Math.sqrt(n));
  for (let k = 0; k < n; k++) out.push(...callersInCell(k % side, (k / side) | 0, habitatAt, seed));
  return out;
}
/** Same rising edge as BorealSound.update: time starts at 0, the first frame that is due plays, the next is one phrase later. */
function pantTimes(dt: number, seconds: number) {
  const gap = pantGap();
  const out: number[] = [];
  let time = 0, next = 0;
  while (time < seconds - 1e-9) {
    time += dt;
    if (time >= next) { out.push(time); next = time + gap; }
  }
  return out;
}
function playback(id: string, kind: 'loon' | 'woodpecker', hour: number, dt: number, seconds: number) {
  const out: number[] = [];
  let t = 0;
  while (t < seconds - 1e-9) {
    const t1 = Math.min(seconds, t + dt);
    if (callTimes(id, kind, t, t1, hour, DAY).length) out.push(t1);
    t = t1;
  }
  return out;
}

test('published loon and woodpecker intervals, including the silent night', () => {
  assert.equal(DAY_OF_YEAR, DAY);
  assert.equal(CALLERS.loonTerritoryHa, 70);
  assert.equal(CALLERS.loonWailsNight, 166.8);
  assert.equal(CALLERS.loonWailsDay, 9.3);
  assert.equal(CALLERS.woodpeckerPerHa, 0.125);
  assert.equal(CALLERS.woodpeckerDrumsPerMin, 4);
  assert.equal(CALLERS.cell, 64);
  assert.ok(sunPosition(2, DAY).elevation < 0, 'hour 2 is night on day 227');
  assert.ok(sunPosition(12, DAY).elevation > 0, 'hour 12 is day on day 227');
  for (const hour of [2, 12]) {
    const got = callGap('loon', hour, DAY), want = publishedGap('loon', hour);
    assert.ok(Math.abs(got - want) < 1e-9, `loon hour ${hour}: ${got} vs ${want}`);
    const span = want * 8;
    const times = callTimes('loon:test', 'loon', 0, span, hour, DAY);
    assert.ok(times.length >= 7, `calls ${times.length}`);
    assert.ok(timingScore(times, want) >= 0.95, `loon timing ${timingScore(times, want)}`);
    const doubled = times.filter((_, i) => i % 2 === 0);
    assert.ok(timingScore(doubled, want) < 0.7, `doubled loon interval must fail, scored ${timingScore(doubled, want)}`);
  }
  assert.equal(callGap('woodpecker', 12, DAY), 15);
  assert.equal(callGap('woodpecker', 2, DAY), Infinity);
  assert.deepEqual(callTimes('pecker', 'woodpecker', 0, 300, 2, DAY), []);
  const drums = callTimes('pecker', 'woodpecker', 0, 300, 12, DAY);
  assert.ok(timingScore(drums, 15) >= 0.95);
  assert.equal(callGap('loon', 12, DAY, 0), Infinity);
  assert.ok(Math.abs(callGap('woodpecker', 12, DAY, 2) - 7.5) < 1e-12);
  const again = callTimes('pecker', 'woodpecker', 0, 300, 12, DAY);
  assert.deepEqual(again, drums);
});

test('a caller sits on its own habitat, and a moved loon scores as a mismatch', () => {
  const full = lake(2); // smallest stage-2b lake. Cell probability is cellHa / 2, not 1: a legal lake is at least 2 ha.
  const loons = collect(200, () => full);
  const pLoon = Math.min(1, cellHa / 2);
  assert.ok(Math.abs(loons.length - 200 * pLoon) < 4 * Math.sqrt(200 * pLoon * (1 - pLoon)), `${loons.length} loons`);
  assert.ok(loons.every(c => c.kind === 'loon' && c.clip === 'loon'));
  assert.equal(positionScore(loons, () => full), 1);
  const woods = collect(400, () => forest, 9).filter(c => c.kind === 'woodpecker');
  assert.ok(woods.length > 0, 'forest cells place woodpeckers');
  assert.equal(positionScore(woods, () => forest), 1);
  assert.equal(collect(80, () => bare).length, 0);
  assert.equal(collect(40, () => lake(1.9)).length, 0);
  assert.equal(collect(20, () => lake(Infinity)).length, 0);
  const split = (x: number): Habitat => x < 0 ? full : forest;
  const placed: Caller[] = [];
  for (let i = -20; i < 20; i++) for (let j = 0; j < 5; j++) placed.push(...callersInCell(i, j, split, 3));
  assert.ok(placed.some(c => c.kind === 'loon') && placed.some(c => c.kind === 'woodpecker'));
  assert.equal(positionScore(placed, split), 1);
  const flipped = placed.filter(c => c.kind === 'loon').map(c => ({ ...c, x: Math.abs(c.x) + CALLERS.cell }));
  assert.ok(flipped.length > 0);
  assert.equal(positionScore(flipped, split), 0);
  let home: Caller | undefined;
  for (let i = 0; i < 40 && !home; i++) home = callersInCell(i, 5, () => full, 11)[0];
  assert.ok(home);
  const near = callersNear(home.x, home.z, 45, () => full, 11);
  assert.ok(near.some(c => c.id === home.id));
  assert.ok(near.every(c => Math.hypot(c.x - home.x, c.z - home.z) <= 45));
});

test('woodpecker draws sit near 12.5 pairs per km²', () => {
  const n = 2000, p = 0.125 * cellHa;
  const count = collect(n, () => forest, 1400).length;
  const se = Math.sqrt(n * p * (1 - p));
  assert.ok(Math.abs(count - n * p) < 4 * se, `${count} woodpeckers, expected ${n * p} ± ${4 * se}`);
  assert.ok(collect(n, () => forest, 1400).every(c => c.kind === 'woodpecker'));
});

test('pant follows run speed or the stamina recovery line, at 5.33 Hz', () => {
  assert.equal(PANT_HZ, 5.33);
  assert.equal(modeSpeed.run, 4);
  const gap = 4 / 5.33;
  assert.ok(Math.abs(pantGap() - gap) < 1e-12);
  assert.equal(shouldPant(2, 100, 100), false);
  assert.equal(shouldPant(4, 100, 100), true);
  assert.equal(shouldPant(7, 100, 100), true);
  assert.equal(shouldPant(0, 19, 100), true);
  assert.equal(shouldPant(0, 20, 100), false);
  const exact = Array.from({ length: 12 }, (_, i) => (i + 1) * gap);
  assert.ok(timingScore(exact, gap) >= 0.95);
  const fine = pantTimes(0.01, 20);
  const frame = pantTimes(1 / 30, 30);
  assert.ok(timingScore(fine, gap) >= 0.95, `dt 0.01 scored ${timingScore(fine, gap)}`);
  assert.ok(timingScore(frame, gap) >= 0.95, `dt 1/30 scored ${timingScore(frame, gap)}`);
  const old = Array.from({ length: 10 }, (_, i) => (i + 1) * 3.2);
  assert.ok(timingScore(old, gap) < 0.7, `3.2 s series scored ${timingScore(old, gap)}`);
});

test('one chew per bite, and the deer graze flag is the only chew path', () => {
  assert.equal(mealChews(1.5, 1.5), 1);
  assert.equal(mealChews(1.5, 3), 2);
  assert.equal(mealChews(0, 1), 0);
  assert.equal(mealChews(1.5, 0), 0);
  const prev = { problem: 'graze', motion: 'walk', phase: 0 };
  const now = { key: 'd', motion: 'walk', problem: 'graze', phase: 0, x: 1, z: 2 };
  assert.ok(deerSoundIds(prev, { ...now, chew: true }).includes('chew'));
  assert.equal(deerSoundIds(prev, now).includes('chew'), false);
});

test('mixer levels and the cull stay put, and the phantom timers are gone', () => {
  assert.equal(MIX.birds, 0.3);
  assert.equal(MIX.loon, 0.35);
  assert.equal(MIX.pant, 0.6);
  assert.equal(MIX.chew, 0.6);
  assert.equal(MIX.dawn, 0.45);
  assert.deepEqual(MIX.ambience, { day: 0.5, night: 0.45, wind: 0.25, water: 0.5 });
  assert.equal(CULL_DISTANCE, 45);
  const sound = readFileSync(new URL('../src/audio/borealSound.ts', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const voice = readFileSync(new URL('../src/audio/wolfVoice.ts', import.meta.url), 'utf8');
  for (const needle of ['nextBird', 'nextLoon', 'birdEvery', 'loonEvery', '3.2']) assert.equal(sound.includes(needle), false, needle);
  assert.match(sound, /callersNear\(/);
  assert.match(sound, /shouldPant\(/);
  assert.equal(/setTimeout\(/.test(sound.slice(sound.indexOf('chew'), sound.indexOf('chew') + 80)), false);
  let from = 0;
  while (true) {
    const at = sound.indexOf('setTimeout(', from);
    if (at < 0) break;
    assert.equal(sound.slice(at, at + 80).includes('chew'), false);
    from = at + 10;
  }
  assert.match(main, /mealChews\(/);
  assert.equal(/setTimeout\(/.test(main.slice(Math.max(0, main.indexOf('chewAt') - 80), main.indexOf('chewAt') + 40)), false);
  assert.match(voice, /loonNear \? 'night-1' : 'night-2'/);
});

test('the night line names loons only when a loon is inside hearing', () => {
  const deer = (n: number) => ({ key: `deer-${n}`, kind: 'deer' });
  const ctx = (loonNear: boolean) => ({ darkness: 0.8, loonNear, animal: { problem: 'explore', energy: 80 } });
  const away: string[] = [], here: string[] = [];
  for (let i = 0; i < 40; i++) away.push(chooseLine(deer(i), ctx(false), true));
  for (let i = 0; i < 40; i++) here.push(chooseLine(deer(100 + i), ctx(true), true));
  assert.equal(away.includes('night-1'), false);
  assert.ok(away.includes('night-2'));
  assert.equal(here.includes('night-2'), false);
  assert.ok(here.includes('night-1'));
  const day: string[] = [];
  for (let i = 0; i < 15; i++) day.push(chooseLine(deer(200 + i), { darkness: 0.4, loonNear: true }, true));
  assert.equal(day.some(id => id.startsWith('night')), false);
});

test('real terrain: loons on lakes, woodpeckers on treed land, and the calibrated scores are written', { timeout: 120_000 }, () => {
  const callers: Caller[] = [];
  const side = Math.ceil(7680 / CALLERS.cell);
  for (let iz = 0; iz < side; iz++) for (let ix = 0; ix < side; ix++) callers.push(...callersInCell(ix, iz, habitatOf, WORLD_SEED));
  const loons = callers.filter(c => c.kind === 'loon');
  const woods = callers.filter(c => c.kind === 'woodpecker');
  assert.ok(loons.length > 0, 'at least one loon on the staged map');
  assert.ok(woods.length > 0, 'at least one woodpecker on the staged map');
  let ok = 0;
  for (const c of callers) {
    const p = surfaceAt(c.x, c.z, WORLD_SEED);
    const land = !p.lake && !p.river;
    const match = c.kind === 'loon'
      ? p.lake?.kind === 'lake' && p.lake.areaHa >= 2
      : land && standAt(c.x, c.z, p.wetness, WORLD_SEED).canopy > 0;
    if (match) ok++;
  }
  const realPosition = ok / callers.length;
  assert.ok(realPosition >= 0.95, `real position ${realPosition}`);
  const nightGap = publishedGap('loon', 2);
  const dayGap = publishedGap('loon', 12);
  const loonPlay = timingScore(playback('loon:gate', 'loon', 2, 1 / 30, nightGap * 6), nightGap);
  const drumPlay = timingScore(playback('pecker:gate', 'woodpecker', 12, 1 / 30, 180), 15);
  const pant30 = timingScore(pantTimes(1 / 30, 30), pantGap());
  const pantFine = timingScore(pantTimes(0.01, 20), pantGap());
  assert.ok(loonPlay >= 0.95, `loon playback ${loonPlay}`);
  assert.ok(drumPlay >= 0.95, `drum playback ${drumPlay}`);
  const full = lake(2);
  const stubLoons = collect(200, () => full, 1);
  assert.ok(stubLoons.length > 0);
  const stubWoods = collect(400, () => forest, 2);
  const split = (x: number): Habitat => x < 0 ? full : forest;
  const placed: Caller[] = [];
  for (let i = -20; i < 20; i++) for (let j = 0; j < 5; j++) placed.push(...callersInCell(i, j, split, 4));
  const flipped = placed.filter(c => c.kind === 'loon').map(c => ({ ...c, x: Math.abs(c.x) + 64 }));
  assert.ok(flipped.length > 0, 'the mismatch needs loons to move');
  const score = {
    task: 'T-0017',
    metric: 'timingScore = 1 - |mean interval - expected| / expected; positionScore = matching habitat / callers',
    calibration: 'known match >= 0.95; known mismatch (doubled interval, or loons moved onto land) < 0.7',
    timing: {
      loonNight: timingScore(callTimes('loon:test', 'loon', 0, nightGap * 8, 2, DAY), nightGap),
      loonDay: timingScore(callTimes('loon:test', 'loon', 0, dayGap * 8, 12, DAY), dayGap),
      loonPlayback30Hz: loonPlay,
      woodpecker: timingScore(callTimes('pecker', 'woodpecker', 0, 300, 12, DAY), 15),
      woodpeckerPlayback30Hz: drumPlay,
      pantDt001: pantFine,
      pantDt30Hz: pant30,
      doubledLoonInterval: timingScore(callTimes('loon:test', 'loon', 0, nightGap * 8, 2, DAY).filter((_, i) => i % 2 === 0), nightGap),
      pantAt3_2s: timingScore(Array.from({ length: 10 }, (_, i) => (i + 1) * 3.2), pantGap()),
    },
    position: {
      lakeStub: positionScore(stubLoons, () => full),
      forestStub: positionScore(stubWoods, () => forest),
      loonsMovedToLand: positionScore(flipped, split),
      realTerrain: realPosition,
    },
    expected: { loonNightGap: nightGap, loonDayGap: dayGap, woodpeckerGap: 15, pantGap: pantGap(), loons: loons.length, woodpeckers: woods.length },
    pixels: 'unmeasurable: a frame does not show a call interval or a caller coordinate',
  };
  for (const v of Object.values(score.timing)) {
    if (v === score.timing.doubledLoonInterval || v === score.timing.pantAt3_2s) assert.ok(v < 0.7, String(v));
    else assert.ok(v >= 0.95, String(v));
  }
  assert.ok(score.position.lakeStub >= 0.95 && score.position.forestStub >= 0.95 && score.position.realTerrain >= 0.95);
  assert.ok(score.position.loonsMovedToLand < 0.7);
  const file = join(dirname(new URL(import.meta.url).pathname), '../refs/T-0017/score.json');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(score, null, 2) + '\n');
});
