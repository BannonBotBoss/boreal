// dev-only: dump the staged grid (world metres at nodes) + water mask for comparison with real references
import { writeFileSync } from 'node:fs';
import { elevationGrid, flowGrid, lakeGrid, toWorld } from '../../src/core/stages/elevation';
import { ELEV } from '../../src/core/stages/elevation';
Object.assign(ELEV, JSON.parse(process.env.ELEVP ?? '{}'));
const seed = Number(process.argv[2] ?? 1400), g = elevationGrid(seed), f = flowGrid(seed), L = lakeGrid(seed), N = g.n * g.n;
const z = new Float32Array(N), w = new Uint8Array(N), zf = new Float32Array(N);
for (let c = 0; c < N; c++) { z[c] = toWorld(g, g.h[c]); zf[c] = toWorld(g, f.filled[c]); w[c] = f.outlet[c] || L.id[c] >= 0 ? 1 : 0; }
writeFileSync(process.argv[3] ?? 'grid.bin', Buffer.concat([Buffer.from(new Int32Array([g.n, g.cell]).buffer), Buffer.from(z.buffer), Buffer.from(zf.buffer), Buffer.from(w.buffer)]));
console.log('n', g.n, 'cell', g.cell);
