// Issue #162 bridge: the viewer reads the simulation's local population list through the wasm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPlanetSim, LANDING_SPECIES } from '../src/core/planetBudget';

test('landingPopulation lists the boreal cast, is deterministic, and is empty on water', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim, 'wasm loads');
  const pop = sim!.landingPopulation(55, -100, 300, 0.9, false, 2026, 5000);
  assert.ok(pop.length > 0, 'boreal forest landing has animals');
  for (const p of pop) { assert.ok(LANDING_SPECIES.includes(p.species)); assert.ok(Number.isInteger(p.count) && p.count >= 1); }
  assert.deepEqual(pop, sim!.landingPopulation(55, -100, 300, 0.9, false, 2026, 5000));
  assert.deepEqual(sim!.landingPopulation(45, -95, 0, 1, true, 2026, 5000), []);
});
