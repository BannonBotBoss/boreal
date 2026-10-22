// Cross-section at a recorded site: ground (surfaceAt, carved), river surface, and where the water sheet is drawn
// (terrainCore: river sheet where riverAt d < half + bank, else the sheet is sunk below ground). Flags points where the
// water surface stands above the ground but no sheet is drawn (open edge) and the wetted width actually shown.
// npx tsx refs/water/river-audit/transect.ts <site>
import { readFileSync } from 'node:fs';
import { riverAt } from '../../../src/core/stages/rivers';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
import { STAGES } from '../../../src/core/stages/elevation';

const site = process.argv[2] ?? 'slow1', v = JSON.parse(readFileSync('refs/water/river-audit/views.json', 'utf8'))[site].river;
const [dx, dz] = v.dir, nx = -dz, nz = dx, rows = [];
let wetShown = 0, floatEdge = 0;
for (let o = -20; o <= 20; o += .5) {
  const x = v.x + nx * o, z = v.z + nz * o, r = riverAt(STAGES.seed, x, z), p = surfaceAt(x, z), sheet = !!r && r.d < r.half + r.bank;
  const surf = r ? r.surface : null, above = surf !== null && surf > p.height;
  if (sheet && above) wetShown += .5; if (!sheet && r && above) floatEdge++;
  rows.push({ o, ground: +p.height.toFixed(2), surface: surf === null ? null : +surf.toFixed(2), sheet, inChannel: !!r && r.d < r.half, lake: !!p.lake });
}
console.log(JSON.stringify({ site, channelWidthM: v.widthM, wetWidthShownM: wetShown, openEdgePoints: floatEdge, rows: rows.filter((_, i) => i % 2 === 0) }, null, 0));
