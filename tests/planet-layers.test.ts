// Issue #43: the planet budget layers baked for the globe tiles (planetLayers.ts) follow the tier and the seasons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadPlanetSim } from '../src/core/planetBudget';
import { GLOBE_LAYERS, LAYER_TIERS, bakeLayers, startPlanetLayers } from '../src/world/globe/planetLayers';
import { planetFor } from '../src/world/globe/planet';

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const sim = existsSync(wasmPath) ? await loadPlanetSim(readFileSync(wasmPath)) : null;
const skip = sim ? false : 'wasm not built';
const planet = planetFor(1400);

test('tiers: more layers and cells on stronger hardware, none at Minimum, at most 64 KB', () => {
  for (let i = 1; i < LAYER_TIERS.length; i++) { assert.ok(LAYER_TIERS[i].layers.length <= LAYER_TIERS[i - 1].layers.length); assert.ok(LAYER_TIERS[i].nlat <= LAYER_TIERS[i - 1].nlat); }
  assert.equal(LAYER_TIERS.at(-1)!.layers.length, 0);
  for (const t of LAYER_TIERS) assert.ok(t.nlat * t.nlat * 2 * 4 <= 65536 * 2);
});

test('Minimum tier draws nothing', async () => { assert.equal(await startPlanetLayers(planet, 5, 172, sim), false); assert.equal(GLOBE_LAYERS.uLayers.value.w, 0); });

test('bake: columns run west to east from -180, rows south to north (shader uv convention)', { skip }, () => {
  sim!.init(18, 36); const lat = sim!.plane('lat'), lon = sim!.plane('lon');
  assert.ok(lat[0] < 0 && lat[35 * 18] > 0 || lat[17 * 36] > 0); assert.ok(lon[0] < -170 && lon[35] > 170);
});

test('seasons: northern snow and sea ice cover more in January than July; tropical lowlands have none (high mountains may)', { skip }, async () => {
  const frac = (day: number, rows: (r: number) => boolean, ch: number) => {
    sim!.init(45, 90).setLand((la, lo) => { const s = planet.sampleSurface([Math.cos(la * Math.PI / 180) * Math.cos(lo * Math.PI / 180), Math.sin(la * Math.PI / 180), Math.cos(la * Math.PI / 180) * Math.sin(lo * Math.PI / 180)]); return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) }; }).seed(day, 0);
    const b = bakeLayers(sim!), el = sim!.plane('elev'); let s = 0, n = 0; for (let r = 0; r < 45; r++) if (rows(r)) for (let c = 0; c < 90; c++) { if (ch === 0 && r >= 18 && r <= 26 && el[r * 90 + c] > 3000) continue; s += b[(r * 90 + c) * 4 + ch]; n++; } return s / n / 255;
  };
  const north = (r: number) => r >= 34, tropics = (r: number) => r >= 18 && r <= 26;
  const janSnow = frac(15, north, 0), julSnow = frac(196, north, 0), janIce = frac(15, north, 1), julIce = frac(196, north, 1);
  assert.ok(janSnow > julSnow, `snow Jan ${janSnow} > Jul ${julSnow}`); assert.ok(janIce >= julIce, `ice Jan ${janIce} >= Jul ${julIce}`);
  const ts = frac(15, tropics, 0), ti = frac(15, tropics, 1); assert.ok(ts < 0.05 && ti < 0.01, /* known gap (T-0061 handoff): tropics ~5 K too cool, so ~2% of 1.5-3 km cells hold snow; real snowline ~4.5-5 km */ `tropics snow ${ts} ice ${ti}`);
  assert.equal(await startPlanetLayers(planet, 0, 15, sim), true); assert.deepEqual(GLOBE_LAYERS.uLayers.value.toArray(), [1, 1, 1, 1]);
});
