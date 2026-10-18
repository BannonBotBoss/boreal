import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NIGHT_SKY, SHOWERS, apply3, equatorialToWorld, extinctionMag, galacticLatitude, limitingMagnitude, localSiderealHours, meteorLight,
  sampleMeteor, scintillation, showerRate, starCatalogue, unitRaDec, zhrOn,
} from '../src/core/celestial';
import { LATITUDE } from '../src/core/timeOfDay';
import { random } from '../src/proc/rng';

const cat = starCatalogue(1400);
const brighter = (m: number) => cat.mag.filter(x => x < m).length;

test('star counts follow the observed law: ~15 brighter than 1, ~150 than 3, ~5000 than 6', () => {
  assert.ok(brighter(1) >= 6 && brighter(1) <= 30, `${brighter(1)}`);
  assert.ok(brighter(3) >= 110 && brighter(3) <= 200, `${brighter(3)}`);
  assert.ok(Math.abs(brighter(6) - 5000) < 500, `${brighter(6)}`);
  for (let i = 1; i < cat.count; i++) assert.ok(cat.mag[i] >= cat.mag[i - 1], 'brightest first');
  assert.deepEqual(starCatalogue(1400, 50).mag, starCatalogue(1400, 50).mag, 'seeded');
});
test('faint stars crowd toward the Milky Way, bright ones barely', () => {
  const share = (lo: number, hi: number) => { let n = 0, k = 0; for (let i = 0; i < cat.count; i++) if (cat.mag[i] >= lo && cat.mag[i] < hi) {
    n++; if (Math.abs(galacticLatitude([cat.dir[i * 3], cat.dir[i * 3 + 1], cat.dir[i * 3 + 2]])) < 10 * Math.PI / 180) k++; } return k / n; };
  const bright = share(-2, 3.5), faint = share(6, 8);
  assert.ok(faint > .3 && faint > bright + .05, `${bright} ${faint}`);
});
test('sidereal time: about 0 h at noon on the March equinox, about 21.6 h at midnight in mid-August', () => {
  const lstNoon = localSiderealHours(79, 12);
  assert.ok(Math.min(lstNoon, 24 - lstNoon) < .5, `${lstNoon}`);
  assert.ok(Math.abs(localSiderealHours(227, 0) - 21.6) < .5, `${localSiderealHours(227, 0)}`);
  const d = localSiderealHours(227, 13) - localSiderealHours(227, 12); assert.ok(Math.abs(d - 1.0027379) < 1e-6, 'sidereal rate');
});
test('the celestial pole stands due north at the latitude; the equator crosses the meridian due south', () => {
  const M = equatorialToWorld(5.3);
  const pole = apply3(M, [0, 0, 1]); assert.ok(Math.abs(Math.asin(pole[1]) * 180 / Math.PI - LATITUDE) < 1e-9); assert.ok(pole[2] < 0 && Math.abs(pole[0]) < 1e-12);
  const onMeridian = apply3(M, unitRaDec(5.3 * 15, 0)); assert.ok(Math.abs(Math.asin(onMeridian[1]) * 180 / Math.PI - (90 - LATITUDE)) < 1e-9); assert.ok(onMeridian[2] > 0);
  const west = apply3(M, unitRaDec(5.3 * 15 - 90, 0)); assert.ok(west[0] < -.999, 'hour angle +6 h sets in the west');
  for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) assert.ok(Math.abs(Math.hypot(...apply3(M, v)) - 1) < 1e-12);
});
test('extinction and twinkling grow toward the horizon; the limit falls with twilight and moonlight, rises looking up', () => {
  assert.ok(Math.abs(extinctionMag(1)) < 1e-3); assert.ok(extinctionMag(.1) > 1);
  assert.ok(scintillation(.2) > 3 * scintillation(1));
  assert.ok(Math.abs(limitingMagnitude(-30) - NIGHT_SKY.darkLimit) < 1e-9);
  assert.ok(limitingMagnitude(20) < -2, 'no stars by day');
  assert.ok(limitingMagnitude(-30, 1, 40) < limitingMagnitude(-30) - 1, 'full moon');
  assert.ok(limitingMagnitude(-30, 0, -90, 0, 1) > NIGHT_SKY.darkLimit);
});
test('Perseids: ZHR 100 at the peak, about a third three nights later; nothing while the radiant is down', () => {
  const p = SHOWERS.find(s => s.name === 'Perseids')!;
  assert.equal(zhrOn(p, p.peak), 100); assert.ok(Math.abs(zhrOn(p, 227) - 33) < 3);
  assert.equal(showerRate(100, -5, 6.5, 2.2), 0); assert.ok(Math.abs(showerRate(100, 90, 6.5, 2.2) - 100) < 1e-9);
});
test('meteors: fainter than the limit never, fly away from the radiant, last a fraction of a second, light peaks late', () => {
  const rad = apply3(equatorialToWorld(21.6), unitRaDec(48, 58)), r = random(7);
  for (let i = 0; i < 400; i++) {
    const m = sampleMeteor(r, 6.5, 2.2, 59, rad);
    assert.ok(m.mag <= 6.5); assert.ok(m.start[1] > 0);
    const a0 = Math.acos(m.start[0] * rad[0] + m.start[1] * rad[1] + m.start[2] * rad[2]), a1 = Math.acos(m.end[0] * rad[0] + m.end[1] * rad[1] + m.end[2] * rad[2]);
    assert.ok(a1 > a0, 'moves away from the radiant');
    assert.ok(m.duration > .1 && m.duration < 2.5, `${m.duration}`);
  }
  assert.ok(meteorLight(2 / 3) > meteorLight(1 / 3)); assert.ok(Math.abs(meteorLight(2 / 3) - 1) < 1e-9); assert.equal(meteorLight(1), 0);
});
