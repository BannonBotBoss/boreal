// Box-only tuning helper (not committed): top-down map of the staged generator for the reference comparison.
import { writeFileSync } from 'node:fs';
import { elevationGrid, lakeGrid, toWorld, STAGES } from '../../src/core/stages/elevation';
import { riverGrid } from '../../src/core/stages/rivers';
import { soilGrid, SOIL_KINDS } from '../../src/core/stages/soils';
const s = STAGES.seed, g = elevationGrid(s), L = lakeGrid(s), R = riverGrid(s), S = soilGrid(s), n = g.n;
const z = Float32Array.from(g.h, v => toWorld(g, v)), kind = Array.from(S.kind, k => SOIL_KINDS[k]);
writeFileSync('/workspace/tmp/boreal-ref/game_z.bin', Buffer.from(z.buffer));
writeFileSync('/workspace/tmp/boreal-ref/game_soil.bin', Buffer.from(Uint8Array.from(S.kind).buffer));
writeFileSync('/workspace/tmp/boreal-ref/game_chan.bin', Buffer.from(Uint8Array.from(R.channel).buffer));
console.log(n, g.cell, SOIL_KINDS.join(','), kind.filter(k => k === 'water').length / kind.length);
