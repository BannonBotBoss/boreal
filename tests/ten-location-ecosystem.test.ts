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
  ['Yukon north tundra', 68, -135, 300, 0.3, false, 'tundra', ['caribou', 'red_fox'], ['white_tailed_deer']],
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
