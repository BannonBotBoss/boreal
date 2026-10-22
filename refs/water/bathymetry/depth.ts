// npx tsx refs/water/bathymetry/depth.ts : depth of the open water (staged terrain, app default) around spawn.
// Depth = LEVEL.waterSurface - heightAt on a 5 m grid within R of (0,0); distance to shore = nearest dry cell (ring search).
import { heightAt } from '../../../src/core/world';
import { LEVEL } from '../../../src/core/tuning';
import { STAGES } from '../../../src/core/stages/elevation';
import { surfaceAt } from '../../../src/core/stages/surfaceAt';
STAGES.on = true;
const R = +(process.argv[2] ?? 600), S = 5, n = Math.round(R / S), Y = LEVEL.waterSurface, W = 2 * n + 1;
const d = new Float32Array(W * W), kind: string[] = [];
for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const x = (i - n) * S, z = (j - n) * S; d[j * W + i] = Y - heightAt(x, z); }
const wet = [...d].map((v, k) => [v, k] as const).filter(([v]) => v > 0);
const q = (a: number[], f: number) => a[Math.floor(f * (a.length - 1))];
const dep = wet.map(([v]) => v).sort((a, b) => a - b);
console.log({ R, cells: W * W, wetShare: +(wet.length / (W * W)).toFixed(3), depth_q10: +q(dep, .1).toFixed(2), q50: +q(dep, .5).toFixed(2), q90: +q(dep, .9).toFixed(2), max: +dep[dep.length - 1].toFixed(2) });
// depth by distance to the nearest dry cell (littoral profile)
const prof: Record<number, number[]> = {};
for (const [v, k] of wet) { const i = k % W, j = (k - i) / W; let r = 1, found = 0;
  for (; r <= 40 && !found; r++) for (let dj = -r; dj <= r && !found; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= W) continue; if (d[jj * W + ii] <= 0) { found = Math.hypot(di, dj) * S; break; } }
  const b = found ? Math.min(100, Math.floor(found / 10) * 10) : 200; (prof[b] ??= []).push(v); }
console.table(Object.entries(prof).map(([b, a]) => { a.sort((x, y) => x - y); return { distToShore_m: `${b}-${+b + 10}`, n: a.length, depth_med: +q(a, .5).toFixed(2), depth_q90: +q(a, .9).toFixed(2) }; }));
const p = surfaceAt(-30, 0); console.log('far side probe (-30,0):', JSON.stringify(p.lake), p.height.toFixed(2));
