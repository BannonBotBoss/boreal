// T-0070 core pass: the self-differentiated planet (rust/boreal-sim/src/differentiation.rs) shown by the axis view (K / pad X).
// Boundaries are read from the parcels; PREM values (data/earth/reference-figure.json) are only checked against.
import { test } from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { STRIDE, REAL, DEFAULT_BAKE, parcelReadout, type ParcelBake } from '../src/world/globe/parcels';
const base = new URL('../public' + DEFAULT_BAKE, import.meta.url).pathname;
const buf = new Float32Array(readFileSync(base + '.bin').buffer.slice(0)); const meta: ParcelBake = JSON.parse(readFileSync(base + '.json', 'utf8'));
test('hot bake: only bulk materials (iron 10/12, silicate 11), iron mass fraction as cited, iron at the centre', () => {
  const n = buf.length / STRIDE; assert.equal(n, meta.n); const mats = new Set<number>(); let fe = 0, feR = 0, siR = 0, si = 0;
  for (let i = 0; i < n; i++) { const b = i * STRIDE, m = buf[b + 3], r = Math.hypot(buf[b], buf[b + 1], buf[b + 2]); mats.add(m); if (m !== 11) { fe++; feR += r; } else { si++; siR += r; } }
  for (const m of mats) assert.ok([10, 11, 12].includes(m), `material ${m}`);
  const mf = JSON.parse(readFileSync(new URL('../data/earth/materials.json', import.meta.url), 'utf8')).bulk_core_mass_fraction; assert.ok(Math.abs(fe / n - mf) < 0.01, `iron fraction ${fe / n}`);
  assert.ok(feR / fe < 0.6 * (siR / si), 'iron sits inside the silicate');
});
test('hot bake: emerged boundaries and figure within loose bounds of real Earth', () => {
  assert.ok((meta.separation ?? 0) > 0.95, `separation ${meta.separation}`);
  assert.ok(Math.abs(meta.cmb! / 1e3 / REAL.cmbKm - 1) < 0.15, `cmb ${meta.cmb}`);
  assert.ok(Math.abs(meta.r_vol / REAL.rMean - 1) < 0.08 && Math.abs(meta.mass / REAL.mass - 1) < 0.002);
  assert.ok(Math.abs(meta.g_eq / REAL.gEq - 1) < 0.12, `g ${meta.g_eq}`);
  assert.match(parcelReadout(meta), /emerged: core-mantle/);
});
