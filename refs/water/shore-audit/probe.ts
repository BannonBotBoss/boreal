import { surfaceAt } from '../../../src/core/stages/surfaceAt';
for (const [x, z] of [[0,0],[10,0],[20,0],[30,0],[0,10],[0,-10],[-10,0],[0,30]]) { const p = surfaceAt(x, z); console.log(x, z, p.height.toFixed(2), JSON.stringify(p.lake), JSON.stringify(p.river), p.soil); }
let counts: Record<string, number> = {};
for (let x = -900; x <= 900; x += 15) for (let z = -900; z <= 900; z += 15) { const p = surfaceAt(x, z); const k = p.lake ? 'lake:' + p.lake.kind : p.river ? 'river' : 'dry'; counts[k] = (counts[k] ?? 0) + 1; }
console.log(counts);
