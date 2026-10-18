/**
 * Stage 2a, hydrology core (WORLD-STAGES.md), on the stage-1 grid (wrapping torus):
 *  - Depression filling: Priority-Flood + ε (Barnes, Lehman & Mulla 2014, Computers & Geosciences 62:117, Alg. 3), seeded
 *    from the open-water cells (at or below the base water level: the Lake of the Woods analogue) because a torus has no edge.
 *    The output is strictly drainable: every cell has a lower neighbour on the way to an outlet.
 *  - Flow direction: D8 steepest descent (O'Callaghan & Mark 1984) on the filled surface; outlets = −1.
 *  - Flow accumulation: cells visited in descending filled height, each passes (1 + inflow) to its receiver (O(n log n)).
 *  - Wetness: TWI = ln(a / tan β), with a = upslope area per unit contour width (Beven & Kirkby 1979).
 * Everything is a Float32/Int32 array over the coarse grid, built once per seed in tens of ms.
 */
import type { Grid } from './elevation';

export type Flow = { n: number; cell: number; filled: Float32Array; dir: Int32Array; acc: Float32Array; outlet: Uint8Array; ms: number };
const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1], DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

/** Minimal binary min-heap keyed by height (index payloads). */
class Heap { k: number[] = []; v: number[] = [];
  push(key: number, val: number) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop()!, lv = v.pop()!; if (k.length) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= k.length) break; if (c + 1 < k.length && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; } }

export function computeFlow(g: Pick<Grid, 'n' | 'cell' | 'h'>, waterLevel: number): Flow {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), n = g.n, N = n * n, h = g.h;
  const filled = new Float32Array(N), done = new Uint8Array(N), outlet = new Uint8Array(N), heap = new Heap(), eps = 1e-4;
  const nb = (c: number, d: number) => { const x = c % n, y = (c / n) | 0; return ((y + DY[d] + n) % n) * n + (x + DX[d] + n) % n; };
  let seeded = 0;
  for (let c = 0; c < N; c++) if (h[c] <= waterLevel) { filled[c] = h[c]; done[c] = 1; outlet[c] = 1; heap.push(h[c], c); seeded++; }
  if (!seeded) { let m = 0; for (let c = 1; c < N; c++) if (h[c] < h[m]) m = c; filled[m] = h[m]; done[m] = 1; outlet[m] = 1; heap.push(h[m], m); } // no open water: lowest cell drains the world
  while (heap.size) { // Priority-Flood + ε: each neighbour is raised to at least (current + ε) so filled flats still slope to the outlet
    const c = heap.pop();
    for (let d = 0; d < 8; d++) { const m = nb(c, d); if (done[m]) continue; done[m] = 1; filled[m] = Math.max(h[m], filled[c] + eps); heap.push(filled[m], m); }
  }
  const dir = new Int32Array(N).fill(-1);
  for (let c = 0; c < N; c++) { if (outlet[c]) continue; let best = 0, bd = -1;
    for (let d = 0; d < 8; d++) { const s = (filled[c] - filled[nb(c, d)]) / DIST[d]; if (s > best) { best = s; bd = d; } }
    dir[c] = bd < 0 ? -1 : nb(c, bd); }
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => filled[b] - filled[a]), acc = new Float32Array(N).fill(1);
  for (const c of order) if (dir[c] >= 0) acc[dir[c]] += acc[c];
  return { n, cell: g.cell, filled, dir, acc, outlet, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}
/** Topographic wetness index at a cell (Beven & Kirkby 1979). */
export function twi(f: Flow, c: number) {
  const n = f.n, x = c % n, y = (c / n) | 0; let s = 0;
  for (let d = 0; d < 8; d += 2) { const m = ((y + DY[d] + n) % n) * n + (x + DX[d] + n) % n; s = Math.max(s, Math.abs(f.filled[c] - f.filled[m]) / f.cell); }
  return Math.log(f.acc[c] * f.cell / Math.max(1e-3, s));
}
export const cellAt = (f: { n: number; cell: number }, x: number, z: number) => { const n = f.n, i = ((Math.round(x / f.cell) % n) + n) % n, j = ((Math.round(z / f.cell) % n) + n) % n; return j * n + i; };
