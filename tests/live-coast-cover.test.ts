// #192/#235: viewer cover reads the bound grid's coast distance; no grid or NaN keeps the zonal lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindPlanetWeather, liveCoastM } from '../src/core/planetWeather';
import { coverKind } from '../src/world/globe/coverKind';
import type { PlanetSim } from '../src/core/planetBudget';

const stub = (m: number) => ({ coastAt: () => m } as unknown as PlanetSim);

test('liveCoastM is undefined with no grid and when the grid says NaN', () => {
  bindPlanetWeather(null);
  assert.equal(liveCoastM(64.5, -119.7), undefined);
  bindPlanetWeather(stub(NaN));
  assert.equal(liveCoastM(64.5, -119.7), undefined);
  bindPlanetWeather(null);
});

test('liveCoastM passes the bound grid distance into coverKind', () => {
  bindPlanetWeather(stub(900_000));
  const c = liveCoastM(64.5, -119.7);
  assert.equal(c, 900_000);
  assert.equal(coverKind(64.5, 300, 0.8, false, c), coverKind(64.5, 300, 0.8, false, 900_000));
  bindPlanetWeather(null);
});
