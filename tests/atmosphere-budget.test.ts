import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AIR } from '../src/core/weather';
import { gravity } from '../src/proc/physics';
import { PLANET, fromLatLon } from '../src/world/globe/planet';
import { CLOUDS } from '../src/world/globe/atmosphere';
import { atmosphereBudget, atmosphereFrom, cloudFraction, cloudGrid, coriolis, geostrophicWind, RH_CRIT } from '../src/core/planet/atmosphereBudget';

test('T-0059: 0.001 Pa/m at 49.77 N gives Vg = |grad p| / (rho f) to 1%', () => {
  const lat = PLANET.home.latDeg, T = 288.15;
  const p = AIR.p0 * Math.exp(-gravity() * 0 / (AIR.Rd * T)), rho = p / (AIR.Rd * T);
  const f = 2 * AIR.omega * Math.sin(lat * Math.PI / 180);
  assert.ok(Math.abs(coriolis(lat) - f) < 1e-12);
  const g = geostrophicWind(0.001, 0, rho, lat)!;
  const want = 0.001 / (rho * f), got = Math.hypot(g.u, g.v);
  console.log(`Vg model ${got.toFixed(3)} m/s, |grad p|/(rho f) ${want.toFixed(3)} m/s (rho ${rho.toFixed(4)}, f ${f.toExponential(4)})`);
  assert.ok(Math.abs(got - want) / want < 0.01);
  assert.ok(g.v > 0 && Math.abs(g.u) < 1e-12, 'pressure rising east: wind blows north (low pressure on the left in the NH)');
});

test('T-0059: the equator keeps the synoptic vector, no division by f = 0', () => {
  assert.equal(geostrophicWind(0.001, 0, 1.2, 0), null);
  const b = atmosphereFrom(200, 12, 0, 0, 0);
  assert.ok(b.synoptic && Number.isFinite(b.u) && Number.isFinite(b.v));
});

test('T-0059: cloud forms only past the critical humidity, full at saturation', () => {
  assert.equal(cloudFraction(RH_CRIT), 0);
  assert.equal(cloudFraction(1), 1);
  assert.ok(cloudFraction(0.9) > 0 && cloudFraction(0.9) < 1);
});

test('T-0059: mid-latitude thermal wind is westerly aloft, all fields finite', () => {
  const b = atmosphereFrom(15, 12, 45, 0, 0); // January, warm south, cold north
  assert.ok(!b.synoptic && b.u > 0, `u ${b.u}`);
  const c = atmosphereBudget(1, 200, 15, fromLatLon(PLANET.home.latDeg * Math.PI / 180, -94.36 * Math.PI / 180));
  for (const v of Object.values(c)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
  assert.ok(c.opticalDepth >= 0 && c.cloudFraction >= 0 && c.cloudFraction <= 1 && c.cloudBaseM >= 0);
});

test('T-0059: summer noon over land is more unstable than the same cell before dawn', () => {
  const noon = atmosphereFrom(200, 14, 49.77, -94.36, 370), dawn = atmosphereFrom(200, 4, 49.77, -94.36, 370);
  assert.ok(noon.instabilityK > dawn.instabilityK);
});

test('T-0059: cloud grid is in range and Minimum tier still draws 0 octaves', () => {
  const g = cloudGrid(200, 12, 8);
  assert.equal(g.length, 128);
  for (const v of g) assert.ok(v >= 0 && v <= 1);
  assert.equal(CLOUDS.octaves[CLOUDS.octaves.length - 1], 0);
});
