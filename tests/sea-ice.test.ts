// Sea-ice edge: sub-grid concentration (hydrosphere_budget::ice_fraction_subgrid) and the October extent vs NSIDC Sea Ice Index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim } from '../src/core/planetBudget';
import { fromLatLon, planetFor } from '../src/world/globe/planet';
const w = new URL('../public/wasm/boreal_sim.wasm', import.meta.url), sim = existsSync(w) ? await loadPlanetSim(readFileSync(w)) : null;
const ref = JSON.parse(readFileSync('data/nsidc/october-extent.json', 'utf8')).oct2025;
test('October sea-ice extent within 35% of NSIDC (procedural continents differ from Earth) and the edge is graded', { skip: !sim }, () => {
  const planet = planetFor(1400), nl = 64; sim!.init(nl, nl * 2).setLand((la, lo) => { const s = planet.sampleSurface(fromLatLon(la * Math.PI / 180, lo * Math.PI / 180)); return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) }; }).seed(288, 0);
  for (let i = 0; i < 8; i++) sim!.step(21600);
  const ice = sim!.plane('ice'), R = 6371; let N = 0, S = 0, partial = 0;
  for (let i = 0; i < sim!.n; i++) { const la = -90 + (Math.floor(i / (nl * 2)) + .5) * 180 / nl, a = (Math.PI * R / nl) * (2 * Math.PI * R / (nl * 2)) * Math.cos(la * Math.PI / 180);
    if (ice[i] >= .15) { if (la > 0) N += a / 1e6; else S += a / 1e6; } if (ice[i] > .05 && ice[i] < .95) partial++; }
  assert.ok(Math.abs(N / ref.N - 1) < .35, `N ${N}`); assert.ok(Math.abs(S / ref.S - 1) < .35, `S ${S}`); assert.ok(partial > 2 * nl, `graded edge cells ${partial}`);
});
