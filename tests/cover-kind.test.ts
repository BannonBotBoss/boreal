/** Ground cover class for the drone view; one rule shared with rust cover.rs (#167). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coverKind, coverRow, coverSpacingM, coverSpots } from '../src/world/globe/coverKind';
import { loadPlanetSim } from '../src/core/planetBudget';
import { SEAM_LOCATIONS } from '../tools/globe-seam-baseline';

test('water, ice, tundra, desert, prairie and boreal follow the latitude breaks', () => {
  assert.equal(coverKind(50, 300, 0.8, true), 'water');
  assert.equal(coverKind(80, 400, 0.2, false), 'ice'); // sea-level 80N is polar desert, ice line ~305 m
  assert.equal(coverKind(68, 40, 0.2, false), 'tundra'); // 64N is now below its ~180 m summer-quarter tree line (forested, as at Fairbanks)
  assert.equal(coverKind(50, 1800, 0.2, false), 'rock'); // tree line ~1330 m, ice line ~2310 m at 50N
  assert.equal(coverKind(25, 400, 0.1, false), 'desert');
  assert.equal(coverKind(42, 300, 0.4, false), 'prairie');
  assert.equal(coverKind(52, 300, 0.8, false), 'boreal');
  assert.equal(coverKind(-3, 50, 0.95, false), 'tropical');
  assert.equal(coverKind(57, 80, 0.6, false), 'wetland');
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

test('viewer cover row (stems, height) matches wasm cover_cell bit for bit, and billboards scale to it', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  let n = 0;
  for (let lat = -70; lat <= 70; lat += 7.3) for (let lon = -179.9; lon <= 180; lon += 23.7) for (const elev of [0, 200, 900]) for (const veg of [0.1, 0.45, 0.8]) {
    const ts = coverRow(lat, lon, elev, veg, false), rs = sim!.coverCell(lat, lon, elev, veg, false);
    assert.equal(ts.kind, rs.kind);
    assert.equal(ts.stemsPerHa, rs.stemsPerHa, `stems ${lat},${lon}`);
    assert.ok(Math.abs(ts.heightM - rs.heightM) < 1e-9, `height ${lat},${lon}: ${ts.heightM} vs ${rs.heightM}`);
    n++;
  }
  for (const s of SEAM_LOCATIONS) {
    const ts = coverRow(s.lat, s.lon, 300, 0.7, false), rs = sim!.coverCell(s.lat, s.lon, 300, 0.7, false);
    assert.equal(ts.stemsPerHa, rs.stemsPerHa, s.name); assert.ok(Math.abs(ts.heightM - rs.heightM) < 1e-9, s.name);
  }
  assert.ok(n > 1000);
  const { billboardScale, CARD_HEIGHT_M } = await import('../src/render/horizonCover');
  const boreal = coverRow(52, -100, 300, 0.8, false), prairie = coverRow(42, -100, 300, 0.4, false);
  assert.ok(boreal.heightM >= 10 && boreal.heightM <= 25 && prairie.heightM >= 0.4 && prairie.heightM <= 1.5);
  assert.ok(Math.abs(billboardScale(boreal.heightM, 0) * CARD_HEIGHT_M - 0.85 * boreal.heightM) < 1e-9);
  assert.ok(billboardScale(prairie.heightM, 0) < 0.16, 'prairie clumps are knee-high, not a 5.5 m card');
});

test('coast distance: viewer cover matches wasm cover_cell_at (continentality, #192) and NaN keeps the zonal rule', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  let n = 0;
  for (let lat = -85; lat <= 85; lat += 5) for (const coast of [NaN, 0, 5e3, 6e4, 3e5, 6e5, 2e6]) for (const elev of [0, 60, 200, 380, 700, 1300, 2200, 3500])
    for (const veg of [0.2, 0.5, 0.8]) {
      const ts = coverRow(lat, -100, elev, veg, false, coast), rs = sim!.coverCellAt(lat, -100, elev, veg, false, coast);
      assert.equal(ts.kind, rs.kind, `lat ${lat} coast ${coast} elev ${elev} veg ${veg}`);
      assert.equal(ts.stemsPerHa, rs.stemsPerHa); n++;
    }
  assert.ok(n > 5000);
  // NaN and an omitted distance are the old zonal answer.
  assert.equal(coverKind(64.5, 376, 0.8, false, NaN), coverKind(64.5, 376, 0.8, false));
  // #233's site: 64.5 N at 376 m is boreal 600 km inland and treeless on the coast.
  assert.equal(coverKind(64.5, 376, 0.8, false, 6e5), 'boreal');
  assert.notEqual(coverKind(64.5, 376, 0.8, false, 0), 'boreal');
});
