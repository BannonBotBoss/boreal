// npx tsx refs/water/shore-audit/water-fraction.ts : share of sample points under water (lake/pond/open/river) in growing squares around spawn
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
for (const R of [450, 900, 2500, 5000]) { const c: Record<string, number> = {}; let n = 0; const step = R / 60;
  for (let x = -R; x <= R; x += step) for (let z = -R; z <= R; z += step) { const p = surfaceAt(x, z); const k = p.lake ? p.lake.kind : p.river ? 'river' : 'dry'; c[k] = (c[k] ?? 0) + 1; n++; }
  console.log(R, Object.fromEntries(Object.entries(c).map(([k, v]) => [k, +(v / n * 100).toFixed(1)]))); }
