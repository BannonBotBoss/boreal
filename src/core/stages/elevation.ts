/**
 * Stage 1, elevation (WORLD-STAGES.md), seed mode. A small coarse grid is computed once per seed and then sampled bilinearly
 * (far = math: activated cells only read it).
 *  - Base: ridged fBm (Musgrave 1989 ridged multifractal) on a PERIODIC lattice, so the grid tiles seamlessly (toroidal world).
 *  - Hydraulic erosion: particle/droplet model of Beyer 2015 ("Implementation of a method for hydraulic erosion",
 *    TU München), ported from Sebastian Lague's MIT-licensed C# reference (github.com/SebLague/Hydraulic-Erosion):
 *    inertia, sediment capacity ∝ speed·water·slope, erode/deposit, evaporation, gravity. Deterministic via proc/rng.
 *  - Thermal relaxation (talus angle; Musgrave, Kolb & Mace 1989) as a few smoothing passes over steep cells.
 * Relief is real metres (ELEV.reliefM, fitted to Kenora references; see ELEV). Height bands in staged mode come from the
 * stage-3 soils (core/stages/soils), not from the LEVEL heights.
 */
import { hash, random } from '../../proc/rng';

/** Live switch (setting world.stagedTerrain): heightAt reads the staged grid instead of the original layered terrain. */
export const STAGES = { on: false, seed: 1400 };
/** Stage-1 parameters, measured from real Kenora / Lake of the Woods references (tools/terrain-ref, not shipped):
 *  Copernicus GLO-30 DEM + ESA WorldCover 2021 + Sentinel-2 over a 15 x 15 km window east of Kenora (49.735 N, 94.38 W).
 *  Fitted by sweeping these knobs against the reference metrics (reference -> seed 1400 with these values):
 *  - reliefM 60 m = land p99 above base water. 1-km local relief 41 m (DSM) -> 40.5 m. NOEGTS 36 (Hallett & Roed 1980): Lake of
 *    the Woods 323 m to > 366 m, relief "low to moderate (< 60 m)". The DSM includes ~15 m of canopy, so terrain is a bit lower.
 *  - waterPct .2 (+ filled lakes): water fraction 29 % -> 31 %.
 *  - persistence .5, basins 1: autocorrelation length 930 m -> 1080 m. The spectrum is still steeper (beta -3.1 -> -4.0): the
 *    30 m grid lacks short-scale roughness, which surface detail adds at runtime [follow-up].
 *  - grain 2 (integer: periodic lattice), grainOctaves 2, grainMix .4: NE-SW grain along (x+, z-) (x east, z south). Ridge
 *    strike 42 deg -> 39 deg azimuth, structure-tensor coherence .25 -> .29; lake long axes peak at 30-60 deg in both.
 *  - lakeMinDepth 1 m: shallower filled depressions are wetlands (stage 3 peat), not open water. Lakes >= 1 ha per 100 km^2
 *    17.6 -> 39, median 7 ha -> 23 ha (still too few small lakes) [follow-up]. */
export const ELEV = { n: 256, cell: 30, relief: 14, droplets: 60000, seedOffset: 0, reliefM: 60, waterPct: .2, persistence: .5, grain: 2, grainOctaves: 2, grainMix: .4, basins: 1, lakeMinDepth: 1 };
export type Grid = { n: number; cell: number; h: Float32Array; min: number; max: number; ms: number; /** base-water grid level */ pw: number; /** grid units -> metres */ k: number };

/** Periodic value-noise lattice: hashed ONCE per (period, salt) into a table; wraps every `period` cells. */
function lattice(period: number, salt: number) {
  const L = new Float32Array(period * period);
  for (let j = 0; j < period; j++) for (let i = 0; i < period; i++) L[j * period + i] = random(hash(`${salt}:${i}:${j}`))(); // mulberry32 step = avalanche: raw FNV-1a barely mixes the last characters, which made the lattice correlated along j (an E-W gradient artefact, coherence 0.8)
  return L;
}
function vnoise(L: Float32Array, period: number, x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = xi % period, y0 = yi % period, x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
  const a = L[y0 * period + x0], b = L[y0 * period + x1], c = L[y1 * period + x0], d = L[y1 * period + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function base(n: number, seed: number) {
  const h = new Float32Array(n * n), oct = Array.from({ length: 6 }, (_, o) => ({ per: 4 << o, L: lattice(4 << o, seed * 31 + o) })), low = lattice(3, seed * 31 + 99);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let amp = 1, sum = 0, norm = 0, weight = 1, o = 0;
    for (const { per, L } of oct) { // grain: u = along NE (i - j), v = across (i + j); u wraps by per and v by per when i or j wrap by n
      const iso = vnoise(L, per, i / n * per, j / n * per), s = o++ < ELEV.grainOctaves ? iso + (vnoise(L, per, (i - j + n) / n * per, (i + j) / n * per * ELEV.grain) - iso) * ELEV.grainMix : iso; // ELEV.grain must be an integer (periodicity)
      const r = (1 - Math.abs(s * 2 - 1)) ** 2; sum += r * amp * weight; weight = Math.min(1, r * 1.6); norm += amp; amp *= ELEV.persistence; } // ridged multifractal
    h[j * n + i] = sum / norm * .7 + vnoise(low, 3, i / n * 3, j / n * 3) * ELEV.basins; // + broad basins (big lakes)
  }
  return h;
}
/** Beyer/Lague droplet erosion on a wrapping grid (heights in grid units, cell = 1); allocation-free inner loop. */
function erode(h: Float32Array, n: number, drops: number, seed: number) {
  const inertia = .05, capacity = 4, minSlope = .01, depositK = .3, erodeK = .3, evaporate = .01, gravity = 4, lifeMax = 30;
  const r = random(hash(`erosion:${seed}`));
  let gx = 0, gy = 0, gh = 0;
  const grad = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const nw = h[y0 * n + x0], ne = h[y0 * n + x1], sw = h[y1 * n + x0], se = h[y1 * n + x1];
    gx = (ne - nw) * (1 - v) + (se - sw) * v; gy = (sw - nw) * (1 - u) + (se - ne) * u; gh = nw * (1 - u) * (1 - v) + ne * u * (1 - v) + sw * (1 - u) * v + se * u * v; };
  for (let d = 0; d < drops; d++) {
    let x = r() * n, y = r() * n, dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    for (let life = 0; life < lifeMax; life++) {
      const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, x0 = ((xi % n) + n) % n, y0 = ((yi % n) + n) % n, x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      grad(x, y); const h0 = gh;
      dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
      const len = Math.hypot(dx, dy); if (len < 1e-9) break; dx /= len; dy /= len; x += dx; y += dy;
      grad(x, y); const dh = gh - h0, cap = Math.max(-dh * speed * water * capacity, minSlope);
      let amt: number;
      if (sed > cap || dh > 0) { amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depositK; sed -= amt; }
      else { amt = -Math.min((cap - sed) * erodeK, -dh); sed -= amt; } // negative = erode (4-corner brush; Lague uses a radius brush)
      h[y0 * n + x0] += amt * (1 - u) * (1 - v); h[y0 * n + x1] += amt * u * (1 - v); h[y1 * n + x0] += amt * (1 - u) * v; h[y1 * n + x1] += amt * u * v;
      speed = Math.sqrt(Math.max(0, speed * speed + dh * gravity)); water *= 1 - evaporate;
    }
  }
}
function thermal(h: Float32Array, n: number, talus: number, passes: number) {
  for (let p = 0; p < passes; p++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, e = j * n + (i + 1) % n, s = ((j + 1) % n) * n + i;
    for (const m of [e, s]) { const d = h[k] - h[m]; if (Math.abs(d) > talus) { const t = (Math.abs(d) - talus) * .25 * Math.sign(d); h[k] -= t; h[m] += t; } }
  }
}
const cache = new Map<number, Grid>();
/** The seed's elevation grid (metres, game scale), built once (~0.3–1 s) and cached. */
export function elevationGrid(seed: number): Grid {
  let g = cache.get(seed); if (g) return g;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), n = ELEV.n, h = base(n, seed);
  for (let k = 0; k < h.length; k++) h[k] *= 40; // grid units: give droplets real slopes (≈ 40 cells of relief)
  erode(h, n, ELEV.droplets, seed); thermal(h, n, 1.2, 3);
  let min = Infinity, max = -Infinity; for (const v of h) { min = Math.min(min, v); max = Math.max(max, v); }
  for (let k = 0; k < h.length; k++) h[k] = (h[k] - min) / (max - min) * ELEV.relief;
  const sorted = Float32Array.from(h).sort();
  const pw = sorted[Math.floor(sorted.length * ELEV.waterPct)], p99 = sorted[Math.floor(sorted.length * .99)];
  g = { n, cell: ELEV.cell, h, min: 0, max: ELEV.relief, pw, k: ELEV.reliefM / (p99 - pw), ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 }; cache.set(seed, g); return g;
}
/** Bilinear sample in world metres (wrapping). */
export function sampleGrid(g: { n: number; cell: number; h: Float32Array }, x: number, z: number) {
  const n = g.n, fx = x / g.cell, fz = z / g.cell, xi = Math.floor(fx), zi = Math.floor(fz), u = fx - xi, v = fz - zi, w = (i: number) => ((i % n) + n) % n;
  const a = g.h[w(zi) * n + w(xi)], b = g.h[w(zi) * n + w(xi + 1)], c = g.h[w(zi + 1) * n + w(xi)], d = g.h[w(zi + 1) * n + w(xi + 1)];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
import { computeFlow, type Flow } from './flow';
import { LEVEL } from '../tuning';
/** Grid units → game metres: base water (ELEV.waterPct) sits at LEVEL.waterSurface; the 99th percentile is ELEV.reliefM above it. */
export const toWorld = (g: Grid, e: number) => (e - g.pw) * g.k + LEVEL.waterSurface;
const flows = new Map<number, Flow>();
/** Stage 2a for the seed: flow over the stage-1 grid in the same units heightAt uses (base water = the 8th percentile). */
export function flowGrid(seed: number): Flow { let f = flows.get(seed); if (!f) { const g = elevationGrid(seed); flows.set(seed, f = computeFlow(g, g.pw)); } return f; }

/** Stage 2b, lakes and ponds: filled depressions (fill depth > ELEV.lakeMinDepth in game metres), labelled into connected water bodies
 *  (4-connected flood fill) and classified by area and depth. Pond < 2 ha; lake ≥ 2 ha (a common limnological cut-off,
 *  e.g. Biggs et al. 2005; Ontario uses 'small lakes' < 10 ha) [verify]. Depth classes: shallow < 1 m, deep ≥ 1 m [game scale]. */
export type Lakes = { id: Int32Array; bodies: { cells: number; areaHa: number; level: number; maxDepth: number; kind: 'pond' | 'lake' }[] };
const lakeCache = new Map<number, Lakes>();
export function lakeGrid(seed: number): Lakes {
  let L = lakeCache.get(seed); if (L) return L;
  const g = elevationGrid(seed), fl = flowGrid(seed), n = g.n, N = n * n, id = new Int32Array(N).fill(-1), k = g.k;
  const wet = (c: number) => !fl.outlet[c] && (fl.filled[c] - g.h[c]) * k > ELEV.lakeMinDepth, bodies: Lakes['bodies'] = [];
  for (let c = 0; c < N; c++) if (wet(c) && id[c] < 0) {
    const b = bodies.length, stack = [c]; id[c] = b; let cells = 0, level = -Infinity, maxDepth = 0;
    while (stack.length) { const q = stack.pop()!; cells++; level = Math.max(level, toWorld(g, fl.filled[q])); maxDepth = Math.max(maxDepth, (fl.filled[q] - g.h[q]) * k);
      const x = q % n, y = (q / n) | 0;
      for (const m of [y * n + (x + 1) % n, y * n + (x + n - 1) % n, ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) if (id[m] < 0 && wet(m)) { id[m] = b; stack.push(m); } }
    const areaHa = cells * g.cell * g.cell / 1e4; bodies.push({ cells, areaHa, level, maxDepth, kind: areaHa < 2 ? 'pond' : 'lake' });
  }
  lakeCache.set(seed, L = { id, bodies }); return L;
}
/** Water surface at a point (game metres) if inside a lake/pond, else undefined. Grid values sit on NODES (i*cell, j*cell),
 *  as in sampleGrid: a point belongs to a body if any of its 4 corner nodes does (was floor(x/cell): a half-cell offset), and
 *  it is wet only where the body's flat level is above the bilinear terrain, so the shoreline is the real contour. */
export function lakeAt(seed: number, x: number, z: number) {
  const g = elevationGrid(seed), L = lakeGrid(seed), n = g.n, i0 = Math.floor(x / g.cell), j0 = Math.floor(z / g.cell); let b = -1;
  for (let k = 0; k < 4 && b < 0; k++) { const i = (((i0 + (k & 1)) % n) + n) % n, j = (((j0 + (k >> 1)) % n) + n) % n; b = L.id[j * n + i]; }
  if (b < 0) return undefined; const body = L.bodies[b]; if (toWorld(g, sampleGrid(g, x, z)) >= body.level) return undefined;
  return { body: b, ...body, surface: body.level };
}
