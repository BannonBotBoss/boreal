/** Ground cover class for the drone view; one rule shared with rust cover.rs (#167). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverKind, coverSpacingM, coverSpots } from '../src/world/globe/coverKind';
import { loadPlanetSim } from '../src/core/planetBudget';
import { SEAM_LOCATIONS } from '../tools/globe-seam-baseline';

test('water, ice, tundra, desert, prairie and boreal follow the latitude breaks', () => {
  assert.equal(coverKind(50, 300, 0.8, true), 'water');
  assert.equal(coverKind(80, 0, 0.2, false), 'ice');
  assert.equal(coverKind(64, 40, 0.2, false), 'tundra');
  assert.equal(coverKind(50, 1200, 0.2, false), 'rock');
  assert.equal(coverKind(25, 400, 0.1, false), 'desert');
  assert.equal(coverKind(42, 300, 0.4, false), 'prairie');
  assert.equal(coverKind(52, 300, 0.8, false), 'boreal');
  assert.equal(coverSpacingM('water'), null);
  assert.equal(coverSpacingM('boreal'), 6);
  assert.ok((coverSpacingM('prairie') ?? 0) > (coverSpacingM('boreal') ?? 0));
});

test('billboards stay outside the near meshes and under the cap', () => {
  const spots = coverSpots(0, 0, 'boreal', 36, 200, 80);
  assert.ok(spots.length > 0 && spots.length <= 80);
  for (const s of spots) {
    const d = Math.hypot(s.x, s.z);
    assert.ok(d >= 36 && d <= 200);
  }
  assert.equal(coverSpots(0, 0, 'tundra').length, 0);
});

test('viewer cover matches the simulation (wasm cover_cell) on a global sweep and the ten sprint sites', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  let n = 0;
  for (let lat = -89; lat <= 89; lat += 4) for (const elev of [0, 30, 150, 400, 900, 1600, 2500, 3500, 4800]) for (const veg of [0.1, 0.27, 0.29, 0.5, 0.61, 0.63, 0.9]) {
    for (const water of [false, true]) {
      const ts: string = coverKind(lat, elev, veg, water), rs: string = sim!.coverCell(lat, 10, elev, veg, water).kind;
      assert.equal(ts, rs, `lat ${lat} elev ${elev} veg ${veg} water ${water}`); n++;
    }
  }
  for (const s of SEAM_LOCATIONS) for (const elev of [0, 500, 2000]) assert.equal(coverKind(s.lat, elev, 0.7, false), sim!.coverCell(s.lat, s.lon, elev, 0.7, false).kind, s.name);
  assert.ok(n > 5000);
});
