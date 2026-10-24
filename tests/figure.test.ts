// Earth's figure emerges from its material field + spin (interior.rs, figure.ts), checked against WGS84 (NGA TR8350.2).
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync, existsSync } from 'node:fs';
import { loadPlanetSim } from '../src/core/planetBudget';
import { earthFigure, figureRadius } from '../src/world/globe/figure';
import { K } from '../src/core/constants';
const w = new URL('../public/wasm/boreal_sim.wasm', import.meta.url), sim = existsSync(w) ? await loadPlanetSim(readFileSync(w)) : null;
test('flattening from Darwin–Radau within 1% of WGS84 1/298.257; a, c within 1 km', () => {
  const { f, a, c } = earthFigure(); assert.ok(Math.abs(1 / f - 298.257) / 298.257 < 0.01, `1/f ${1 / f}`);
  assert.ok(Math.abs(a - 6378137) < 1000 && Math.abs(c - 6356752) < 1000, `${a} ${c}`);
  assert.ok(Math.abs(figureRadius([1, 0, 0]) - a) < 1e-6 && Math.abs(figureRadius([0, -1, 0]) - c) < 1e-6);
});
test('TS figure equals the wasm figure from PREM (one source, locked)', { skip: !sim }, () => {
  const r = sim!.earthFigure(); assert.ok(Math.abs(r.moi - K.earth_moi_prem) < 2e-5, `moi ${r.moi}`); assert.ok(Math.abs(r.rSurfKm - 6371) < 0.01);
  const t = earthFigure(r.rSurfKm * 1000); assert.ok(Math.abs(t.f - r.f) < 1e-7 && Math.abs(t.a / 1000 - r.aKm) < 0.01);
});
