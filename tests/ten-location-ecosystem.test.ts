/** Sprint #192 acceptance item 6 (Oct 31 owner directive): ten real places, checked headless for the cover class and the
 *  animals the sim puts there. Results and known gaps: docs/ten-location-ecosystem.md. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPlanetSim } from '../src/core/planetBudget';

// name, lat, lon, elevation m, vegetation 0..1, water, expected cover, species that must be present, species that must be absent
export const TEN_PLACES = [
  ['Kenora boreal', 49.8, -94.5, 350, 0.85, false, 'boreal', ['snowshoe_hare', 'moose', 'canada_lynx', 'beaver'], []],
  ['BC coast', 49.3, -123.1, 20, 0.8, false, 'boreal', ['bald_eagle', 'american_black_bear'], ['caribou']],
  ['Saskatchewan prairie', 51, -107, 600, 0.45, false, 'prairie', ['white_tailed_deer'], ['canada_lynx', 'snowshoe_hare']],
  ['Hudson Bay lowland', 57, -92, 80, 0.6, false, 'wetland', ['beaver', 'moose', 'caribou'], ['white_tailed_deer', 'snowshoe_hare']],
  ['Rockies alpine', 51.4, -116.2, 2600, 0.1, false, 'ice', [], ['*']],
  ['Yukon north tundra', 68, -135, 300, 0.3, false, 'tundra', ['caribou', 'red_fox', 'arctic_fox'], ['white_tailed_deer']],
  ['Arctic polar', 80, -80, 200, 0.02, false, 'tundra', [], ['white_tailed_deer', 'snowshoe_hare', 'canada_lynx', 'moose']], // polar desert below the ~305 m ice line (Nov 1)
  ['Sahara', 23, 13, 400, 0.02, false, 'desert', [], ['*']],
  ['Amazon', -3, -60, 50, 0.95, false, 'tropical', [], ['canada_lynx', 'caribou', 'snowshoe_hare']],
  ['Pacific ocean', 30, -150, 0, 0, true, 'water', [], ['*']],
] as const;

test('ten places get the expected cover and fitting wildlife', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  for (const [name, lat, lon, elev, veg, water, cover, must, mustNot] of TEN_PLACES) {
    assert.equal(sim!.coverCell(lat, lon, elev, veg, water).kind, cover, `${name}: cover`);
    const pop = sim!.landingPopulationDetail(lat, lon, elev, veg, water, 2026, 5000);
    const have = new Set(pop.map(p => p.species));
    for (const s of must) assert.ok(have.has(s), `${name}: missing ${s}`);
    if ((mustNot as readonly string[]).includes('*')) assert.equal(pop.length, 0, `${name}: expected no animals`);
    else for (const s of mustNot) assert.ok(!have.has(s as never), `${name}: ${s} should not be here`);
    for (const p of pop) assert.ok(p.count > 0 && Number.isFinite(p.perKm2) && p.habitat.length > 0, `${name}: ${p.species} row`);
  }
});

/**
 * T-0132 (#192, grokbot-3's 01:50Z leftovers): the matrix's "tundra" and "alpine" clicks (tools/landing-matrix.mjs) had an
 * empty landing census. Inputs are the landed rows in tasks/evidence/T-0130/matrix.json (DEM elevation, vegetation) and the
 * live grid's coast distance from the same boot the globe runs (bootGlobe at nlat 128, the Ultra layer tier).
 *
 * Tundra 64.5, -119.7: GEBCO 2020 puts the real ground at 391 m (the landing read 376 m). The viewer's cover reads the coast
 * distance (#233, #235), so a continental interior 156 km from the sea gets a ~815 m tree line and draws a boreal stand; the
 * census read the zonal 146 m line, called the same point bare rock and listed nothing. Real place: Taiga Shield / Great
 * Bear Plains High Subarctic, "open, stunted spruce woodlands" south of the tree line (GNWT, Ecological Regions of the NWT:
 * Taiga Shield, 2008), inside the Bluenose-East barren-ground caribou winter range "east and southeast of Great Bear Lake"
 * (GNWT ENR, March 2022 late-winter composition survey). So a boreal cast with caribou, not tundra and not nothing.
 *
 * Alpine 0.5, 54: on Earth this is the Somali Basin, open Indian Ocean at -4,870 m (GEBCO 2020). The seeded planet has land
 * there at 2,166 m, which is 1,300 m below its own tree line (3,491 m from the 6.4 C growing-season rule, Koerner & Paulsen
 * 2004), so it is montane, not alpine: the Earth label is wrong. No species in data/earth/species-density.json ranges into
 * the equatorial Eastern Hemisphere (all are North American or Holarctic boxes from 18 N up), so the honest census is empty.
 */
import { bootGlobe } from '../src/world/globe/bootOrder';
import { globeLandSample } from '../src/world/globe/planetLayers';
import { planetFor } from '../src/world/globe/planet';
import { WORLD_SEED } from '../src/core/world';
import { coverKind } from '../src/world/globe/coverKind';
import { treeLineM } from '../src/core/altitudeZones';
import { LANDING_SPECIES } from '../src/core/planetBudget';

test('T-0132: matrix tundra click censuses the boreal stand the viewer draws, alpine click is montane with no listed species', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim);
  bootGlobe(sim!, 128, 256, globeLandSample(planetFor(WORLD_SEED)), 227, 9);
  const t = { lat: 64.4999720721552, lon: -119.70081190507676, elev: 376.33, veg: 0.7143 }; // T-0130 matrix.json tundra row
  const tc = sim!.coastAt(t.lat, t.lon);
  assert.ok(tc > 50_000, `tundra click is inland on the live grid (${tc} m)`);
  const viewer = coverKind(t.lat, t.elev, t.veg, false, tc);
  assert.equal(viewer, 'boreal', 'viewer cover');
  assert.equal(sim!.coverCellAt(t.lat, t.lon, t.elev, t.veg, false, tc).kind, viewer, 'sim cover with the coast = viewer cover');
  assert.equal(sim!.coverCell(t.lat, t.lon, t.elev, t.veg, false).kind, 'rock', 'zonal line alone: the old census input');
  const pop = sim!.landingPopulation(t.lat, t.lon, t.elev, t.veg, false, 2026, 5000, tc);
  const have = new Set(pop.map(p => p.species));
  for (const s of ['caribou', 'moose', 'snowshoe_hare', 'canada_lynx', 'beaver'] as const) assert.ok(have.has(s), `tundra click: missing ${s}`);
  for (const s of ['arctic_fox', 'white_tailed_deer'] as const) assert.ok(!have.has(s), `tundra click: ${s} should not be here`); // forest, and north of the deer box (60 N)
  assert.deepEqual(sim!.landingPopulation(t.lat, t.lon, t.elev, t.veg, false, 2026, 5000), [], 'no coast = the old zonal census (unchanged API)');

  const a = { lat: 0.49972314913595456, lon: 54.00026267355681, elev: 2166.04, veg: 0.9242 }; // T-0130 matrix.json alpine row
  assert.ok(a.elev < treeLineM(Math.abs(a.lat)) - 1000, 'alpine click is far below its own tree line: montane, not alpine');
  const ac = sim!.coastAt(a.lat, a.lon), cover = sim!.coverCellAt(a.lat, a.lon, a.elev, a.veg, false, ac).kind;
  assert.equal(cover, coverKind(a.lat, a.elev, a.veg, false, ac), 'alpine click: sim and viewer agree');
  assert.ok(!['rock', 'ice', 'tundra', 'water'].includes(cover), `alpine click is vegetated land on the planet (${cover})`);
  const ranges = JSON.parse(readFileSync('data/earth/species-density.json', 'utf8')) as Record<string, { lat: number[]; lon: number[]; lon2?: number[] }>;
  for (const sp of LANDING_SPECIES) {
    const r = ranges[sp], inLon = (b?: number[]) => !!b && a.lon >= b[0] && a.lon <= b[1];
    assert.ok(!(a.lat >= r.lat[0] && a.lat <= r.lat[1] && (inLon(r.lon) || inLon(r.lon2))), `${sp} has no range at 0.5 N 54 E`);
  }
  assert.deepEqual(sim!.landingPopulation(a.lat, a.lon, a.elev, a.veg, false, 2026, 5000, ac), [], 'alpine click: empty census is the real answer');
});
