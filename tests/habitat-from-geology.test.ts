/**
 * T-0205 (#98) verification suite: pins the geology-first landform builders that already exist
 * and programmatically demonstrates the latitude-band habitat shortcuts documented in T-0205.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_SEED } from '../src/core/world';
import { elevationGrid, flowGrid, lakeGrid } from '../src/core/stages/elevation';
import { carve, riverGrid, riverPondGrid, type RiverHit } from '../src/core/stages/rivers';
import { soilAt, soilGrid } from '../src/core/stages/soils';
import { surfaceAt } from '../src/core/stages/surfaceAt';
import { ARCTIC_TREE_LINE_M, siteMaritimeWeight, treeLineAtM, treeLineM, zoneAt } from '../src/core/altitudeZones';
import { coverKind } from '../src/world/globe/coverKind';
import { createPlanet, fromLatLon, iceCover, surfaceColour, vegetationWeight, type Surface } from '../src/world/globe/planet';
import { boundaries, buildPlates } from '../src/world/globe/plates';
import { biomeGrade } from '../src/world/globe/openTiles';

test('T-0205 #98 local staged builders: plateau, hillslope, wetland, lake/pond basins, and carved valley channel', () => {
  const g = elevationGrid(WORLD_SEED);
  const f = flowGrid(WORLD_SEED);
  const L = lakeGrid(WORLD_SEED);
  const R = riverGrid(WORLD_SEED);
  const P = riverPondGrid(WORLD_SEED);
  const S = soilGrid(WORLD_SEED);

  // Basins: Priority-Flood lake bodies (>12 m fill) and channel-crossing river ponds (>0.12 m fill).
  assert.ok(L.bodies.length > 0, 'stage 2b builds closed lake/pond basins via Priority-Flood');
  assert.ok(P.bodies.length > 0, 'stage 2c builds spilled channel-crossing pond basins');
  assert.ok(f.acc.some(a => a > 100), 'stage 2a accumulates D8 upslope catchment cells');
  assert.ok(R.maxOrder >= 2, 'stage 2c extracts multi-order Strahler stream network');

  // Soil/landform MSH classes (Gharari et al. 2011): flat wetland (0), sloped wetland (1), hillslope (2), plateau (3).
  const seen = new Set<string>();
  let peatCount = 0;
  for (let j = 0; j < S.n; j += 4) {
    for (let i = 0; i < S.n; i += 4) {
      const s = soilAt(WORLD_SEED, i * S.cell, j * S.cell);
      seen.add(s.landscape);
      if (s.kind === 'peat') peatCount++;
    }
  }
  for (const cls of ['flat wetland', 'sloped wetland', 'hillslope', 'plateau']) {
    assert.ok(seen.has(cls), `expected soilAt landscape class '${cls}' to be built`);
  }
  assert.ok(peatCount > 0, 'stage 3 builds peat wetlands in high-TWI / shallow-pit depressions');

  // Valley channel incision: carve() lowers terrain along the parabolic bed and sloped bank.
  const hit: RiverHit = {
    d: 0, half: 4, bank: 4.8, surface: 10, depth: 0.8,
    order: 2, dirX: 1, dirZ: 0, speed: 0.6, areaKm2: 8, slope: 0.003,
  };
  assert.ok(carve(12, hit) < 10, 'carve() incises channel bed below water surface');
  assert.ok(carve(12, { ...hit, d: 5 }) < 12, 'carve() grades valley bank between channel edge and upland');

  // surfaceAt forwards soil + wetness + lake + river, while dropping soilAt().landscape ('plateau' etc.).
  const surf = surfaceAt(0, 0, WORLD_SEED);
  assert.equal('landscape' in surf, false, 'surfaceAt does not expose discrete landform class');
  assert.equal(g.n, S.n);
});

test('T-0205 #98 global mountain zone vs decoupled plate kinematics', () => {
  // Alpine mountain rock above the growing-season tree line vs Arctic tundra where tree line < 80 m.
  const midLatTree = treeLineM(46.5);
  assert.ok(midLatTree > ARCTIC_TREE_LINE_M);
  assert.equal(zoneAt(midLatTree + 200, 46.5), 'rock');
  assert.equal(coverKind(46.5, midLatTree + 200, 0.8, false), 'rock');

  const arcticTree = treeLineM(70);
  assert.ok(arcticTree < ARCTIC_TREE_LINE_M);
  assert.equal(zoneAt(200, 70), 'tundra');
  assert.equal(coverKind(70, 200, 0.4, false), 'tundra');

  // Plate kinematics exist (25 MORVEL plates + convergent/divergent/transform boundaries)
  // while createPlanet(seed).sampleSurface depends only on makeNoise(seed), not buildPlates(seed).
  const pl = buildPlates(WORLD_SEED, 2000, 10);
  const bnds = boundaries(pl, 6_371_000, 5);
  assert.ok(bnds.some(b => b.kind === 'convergent'), 'plates.ts classifies convergent boundaries');
  const planet = createPlanet(WORLD_SEED);
  const sample = planet.sampleSurface(fromLatLon(0.4, -1.2));
  assert.equal(typeof sample.h, 'number');
});

test('T-0205 latitude-test audit: coverKind wetland cutoff, planet vegetationWeight/albedo/iceCover ramps, and biomeGrade bands', () => {
  // 1. coverKind.ts:61 / cover.rs:193 — 'wetland' is gated by |lat| >= 50 deg (wetland_lat_min), not TWI/drainage.
  assert.equal(coverKind(50.1, 80, 0.5, false), 'wetland');
  assert.equal(coverKind(49.9, 80, 0.5, false), 'prairie');

  // 2. planet.ts:236 — vegetationWeight multiplies by (1 - smoothstep(60, 66, |lat|)), crushing continental
  //    taiga below its own lifted treeLineAtM (~600 m at 66.5N, 300 km inland) to vegetation = 0 -> 'desert'.
  const coastM = 300_000;
  const mw = siteMaritimeWeight(coastM)!;
  const continentalTreeM = treeLineAtM(66.5, mw);
  assert.ok(continentalTreeM > 400, `expected continental tree line at 66.5N > 400 m, got ${continentalTreeM}`);
  const dryLand: Surface = {
    h: 200, water: -Infinity, level: 0, kind: '', home: 0, x: 0, z: 0,
    soil: '', wet: -1, soilW: [0, 0, 0, -1], soilB: false, mottle: 0.5, hill: 0,
  };
  const dir665 = fromLatLon(66.5 * Math.PI / 180, -130 * Math.PI / 180);
  const veg665 = vegetationWeight(dryLand, dir665, coastM);
  assert.equal(veg665, 0, 'smoothstep(60, 66, lat) zeroes vegetationWeight by 66.5N despite being below treeLineAtM');
  assert.equal(coverKind(66.5, 200, veg665, false, coastM), 'desert');

  // 3. planet.ts:268 — surfaceColour mixes temperate (<45 deg) and tundra (>60 deg) by |lat| on identical Surface.
  const c35 = surfaceColour(dryLand, fromLatLon(35 * Math.PI / 180, 0), [0, 0, 0], coastM);
  const c52 = surfaceColour(dryLand, fromLatLon(52 * Math.PI / 180, 0), [0, 0, 0], coastM);
  assert.notDeepEqual(c35, c52, 'surfaceColour shifts forest albedo across 38..45 deg latitude band');

  // 4. planet.ts:262 — iceCover forces permanent ice via smoothstep(80, 86, lat) even when h << il.
  assert.equal(iceCover(10, 2000, 86), 1);
  assert.equal(iceCover(10, 2000, 75), 0);

  // 5. openTiles.ts:246-252 — biomeGrade applies closed-forest 2.15x green lift to 48..70 deg regardless of cover.
  const rgb: [number, number, number] = [0.2, 0.2, 0.2];
  const g51 = biomeGrade(51, rgb);
  const g40 = biomeGrade(40, rgb);
  const g05 = biomeGrade(5, rgb);
  assert.ok(Math.abs(g51[1] - 0.43) < 1e-12 && Math.abs(g51[0] - 0.24) < 1e-12); // 51N steppe gets boreal forest green boost
  assert.ok(Math.abs(g40[1] - 0.28) < 1e-12 && Math.abs(g40[0] - 0.21) < 1e-12); // 40N forest gets prairie boost
  assert.deepEqual(g05, [0.2, 0.2, 0.2]);                                         // 5N rainforest gets no boost
});
