// Radial frame and altitude (radial.ts): the single altitude source.
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { altitudeAt, surfaceRadius, radiusFor, parseAxisDir, axisPoint } from '../src/world/globe/radial';
import { figureRadius } from '../src/world/globe/figure';
import { K } from '../src/core/constants';
const flat = { sampleSurface: () => ({ h: 0, water: -Infinity }) }, sea = { sampleSurface: () => ({ h: -3000, water: 0 }) }, hill = { sampleSurface: () => ({ h: 1200, water: -Infinity }) };
test('altitude: surface 0, depth negative, sea surface over water, mean-radius variant', () => {
  const eq: [number, number, number] = [1, 0, 0], pole: [number, number, number] = [0, 1, 0];
  assert.equal(altitudeAt(flat, figureRadius(eq), eq).h, 0);
  assert.ok(Math.abs(altitudeAt(sea, figureRadius(pole) + 500, pole).h - 500) < 1e-6, 'over ocean, h is above the water surface');
  const a = altitudeAt(hill, figureRadius(eq) + 1000, eq); assert.ok(Math.abs(a.h + 200) < 1e-6 && Math.abs(a.hSea - 1000) < 1e-6);
  assert.ok(Math.abs(altitudeAt(flat, K.R_earth_mean, pole).hMean) < 1e-9);
  assert.ok(Math.abs(surfaceRadius(flat, eq) - surfaceRadius(flat, pole) - 21300) < 400, 'equator ~21 km further out than pole');
  assert.ok(Math.abs(altitudeAt(hill, radiusFor(hill, 4321, eq), eq).h - 4321) < 1e-6);
});
test('axis: ?dir lat,lon and body:sun; signed r crosses the centre', () => {
  const u = parseAxisDir('90,0')!; assert.ok(Math.abs(u[1] - 1) < 1e-12); assert.equal(parseAxisDir('1,2,3'), null);
  assert.deepEqual(parseAxisDir('body:sun', () => [0, 0, 1]), [0, 0, 1]);
  const p = axisPoint([0, 1, 0], -6371); assert.ok(Math.abs(p[1] + 6.371e6) < 1e-6);
});
