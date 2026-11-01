// Issue #162 bridge: the viewer reads the simulation's local population list through the wasm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPlanetSim, LANDING_SPECIES, SPECIES_HABITAT } from '../src/core/planetBudget';

test('landingPopulation lists the boreal cast, is deterministic, and is empty on water', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  const pop = sim!.landingPopulation(55, -100, 300, 0.9, false, 2026, 5000);
  assert.ok(pop.length > 0, 'boreal forest landing has animals');
  for (const p of pop) { assert.ok(LANDING_SPECIES.includes(p.species)); assert.ok(Number.isInteger(p.count) && p.count >= 1); }
  assert.deepEqual(pop, sim!.landingPopulation(55, -100, 300, 0.9, false, 2026, 5000));
  assert.deepEqual(sim!.landingPopulation(45, -95, 0, 1, true, 2026, 5000), []);
});

test('black bears reach the viewer from a western boreal landing (ids 6 and 7 are bears)', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.equal(LANDING_SPECIES[6], 'american_black_bear'); assert.equal(LANDING_SPECIES[7], 'grizzly_bear');
  const pop = sim!.landingPopulation(55, -120, 300, 0.9, false, 2026, 5000);
  assert.ok(pop.some(p => p.species === 'american_black_bear'), JSON.stringify(pop));
});

test('landingPopulationDetail adds density per km2 and habitat tags for every species (#192 wildlife lane)', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  for (const s of LANDING_SPECIES) assert.ok(SPECIES_HABITAT[s].length > 0, s);
  const d = sim!.landingPopulationDetail(55, -120, 300, 0.9, false, 2026, 5000);
  const plain = sim!.landingPopulation(55, -120, 300, 0.9, false, 2026, 5000);
  assert.equal(d.length, plain.length);
  for (const [i, p] of d.entries()) { assert.equal(p.count, plain[i].count); assert.ok(Math.abs(p.perKm2 - p.count / 25) < 1e-12); assert.ok(p.habitat.length > 0); }
});
