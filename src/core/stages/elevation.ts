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
import { SITE } from '../sitePhase';

/** Live switch (setting world.stagedTerrain): heightAt reads the staged grid instead of the original layered terrain. */
export const STAGES = { on: false, seed: 1400 }; // module default off (tests, tools); the APP default is on via the setting world.stagedTerrain.v2 (core/renderSettings), off with ?stages=0
/** Stage-1 parameters, measured from real Kenora / Lake of the Woods references (tools/terrain-ref, not shipped):
 *  Copernicus GLO-30 DEM + ESA WorldCover 2021 + Sentinel-2 over a 15 x 15 km window east of Kenora (49.735 N, 94.38 W).
 *  Fitted by sweeping these knobs against the reference metrics (reference -> seed 1400; seeds 7 and 99 land close):
 *  - reliefM 50 m = land p99 above base water: 1-km local relief 41 m (DSM) -> 42.7 m. NOEGTS 36 (Hallett & Roed 1980): Lake of
 *    the Woods 323 m to > 366 m, relief "low to moderate (< 60 m)". The DSM includes ~15 m of canopy, so terrain is a bit lower.
 *  - persistence .7, basins .75, droplets 30000 + glacial scour (scourM 20 m over periods 8..32 lattice = 960..240 m, scourPers .8):
 *    spectral slope -3.14 -> -3.41 (was -4.0); 300-3000 m band -2.5 -> -3.2; autocorrelation ~1 km in both.
 *  - grain 2 / grainOctaves 2 / grainMix .4 and scourGrain 3 (integers keep the lattice periodic): NE-SW ice-flow grain.
 *    Gradient direction 42 deg -> 44 deg (x east, z south), structure-tensor coherence .25 -> .29.
 *  - waterPct .27 + lakeMinDepth 12 m + isletMax 1. Filled pits shallower than 12 m become stage-3 peat, as Shield basins infill
 *    to fens and bogs. Islets: a minimum mapping unit on open water (the GDAL sieve / MMU convention): land components of a
 *    single 30 m node (0.09 ha) fully enclosed by base water are lowered into it. Measured with wrap-around labelling for both
 *    lakes and islands (the world is a torus; unwrapped labelling had counted seam fragments as islands, 68 -> 53 at 8 m).
 *    Seeds 1400 / 7 / 99 vs Kenora: lakes >= 1 ha per 100 km^2 17.6 -> 20 / 19 / 19 (was 32 / 17 / 27); islands 42 -> 39 / 27 / 31
 *    (was 53 / 27 / 44), per km^2 of water 1.44 -> 1.19 (was 1.59). Pooled over the three seeds: lake median 7.2 -> 6.5 ha (was
 *    7.8), p90 81 -> 107 ha (was 85), share < 10 ha .55 -> .56 (was .62); elongation 2.22 -> 2.15 / 1.87 / 2.00; water 29 % -> 27 %;
 *    land slope > 0.129 .125 -> .135. Single-node islets were 20 of 40 islands on seed 1400 (Kenora: 12 of 91) and nearly all sit
 *    < 1.5 m above the water, so a height cut-off does not separate them. Cost: fewer perched lakes (>= 1 ha: 4 / 1 / 2, was 8 on
 *    1400); the 12 m pits that fail become peat.
 *  - Land slope > 0.129: DSM 0.28 -> 0.157 (seed 1400; 7 / 99: .123 / .125). The DSM figure is inflated by canopy: WorldCover tree pixels read 0.31, while
 *    canopy-free grass/bare/built pixels read 0.11-0.14, and a 1-cell Gaussian (canopy-edge suppression) gives 0.17. So the
 *    bare-earth target is ~0.12-0.17, not 0.28. */
export const ELEV = { n: 256, cell: 30, relief: 14, droplets: 30000, seedOffset: 0, reliefM: 50, waterPct: .27, persistence: .7, grain: 2, grainOctaves: 2, grainMix: .4, basins: .75, lakeMinDepth: 12, scourM: 20, scourGrain: 3, scourPers: .8, scourOct: 3, scourBase: 8, isletMax: 1 };
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
/** Glacial scour: short-wavelength knob-and-basin relief (periods n/16..n/128 nodes, i.e. 480..60 m) stretched along the NE-SW
 *  ice-flow grain, centred on 0. Added AFTER fluvial erosion, as on the Shield (ice scoured the surface last). */
function scour(n: number, seed: number) {
  const h = new Float32Array(n * n), oct = Array.from({ length: ELEV.scourOct }, (_, o) => ({ per: ELEV.scourBase << o, L: lattice(ELEV.scourBase << o, seed * 53 + o) }));
  let norm = 0; for (let o = 0, a = 1; o < oct.length; o++, a *= ELEV.scourPers) norm += a;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { let a = 1, sum = 0;
    for (const { per, L } of oct) { sum += (vnoise(L, per, (i - j + n) / n * per, (i + j) / n * per * ELEV.scourGrain) - .5) * a; a *= ELEV.scourPers; }
    h[j * n + i] = sum / norm; }
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
/** Minimum mapping unit for islets in open water (GDAL sieve / MMU convention): land components (8-connected, wrapping) fully
 *  enclosed by base water with at most `max` nodes are lowered to the mean of their water neighbours. */
function sieveIslets(h: Float32Array, n: number, pw: number, max: number) {
  const N = n * n, lab = new Uint8Array(N), at = (q: number, dx: number, dy: number) => (((q / n | 0) + dy + n) % n) * n + (q % n + dx + n) % n;
  for (let c = 0; c < N; c++) if (h[c] >= pw && !lab[c]) {
    const st = [c], comp: number[] = []; lab[c] = 1;
    while (st.length) { const q = st.pop()!; comp.push(q);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const m = at(q, dx, dy); if (h[m] >= pw && !lab[m]) { lab[m] = 1; st.push(m); } } }
    if (comp.length > max) continue;
    for (const q of comp) { let s = 0, k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const m = at(q, dx, dy); if (h[m] < pw) { s += h[m]; k++; } }
      h[q] = k ? s / k : pw - 1e-3; }
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
  const levels = () => { const s = Float32Array.from(h).sort(), pw = s[Math.floor(s.length * ELEV.waterPct)]; return { pw, k: ELEV.reliefM / (s[Math.floor(s.length * .99)] - pw) }; };
  let { pw, k } = levels();
  if (ELEV.scourM) { // scourM: amplitude in metres at the provisional scale; then renormalise to [0, relief] and re-derive the levels
    const sc = scour(n, seed); let lo = Infinity, hi = -Infinity;
    for (let c = 0; c < h.length; c++) { h[c] += sc[c] * ELEV.scourM / k; lo = Math.min(lo, h[c]); hi = Math.max(hi, h[c]); }
    for (let c = 0; c < h.length; c++) h[c] = (h[c] - lo) / (hi - lo) * ELEV.relief; ({ pw, k } = levels()); }
  if (ELEV.isletMax) sieveIslets(h, n, pw, ELEV.isletMax);
  g = { n, cell: ELEV.cell, h, min: 0, max: ELEV.relief, pw, k, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 }; cache.set(seed, g); return g;
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
  if (SITE.remote) return undefined; // off home, water is the planet sample inside heightAt, not the Kenora lakes
  const g = elevationGrid(seed), L = lakeGrid(seed), n = g.n, i0 = Math.floor(x / g.cell), j0 = Math.floor(z / g.cell); let b = -1;
  for (let k = 0; k < 4 && b < 0; k++) { const i = (((i0 + (k & 1)) % n) + n) % n, j = (((j0 + (k >> 1)) % n) + n) % n; b = L.id[j * n + i]; }
  if (b < 0) return undefined; const body = L.bodies[b]; if (toWorld(g, sampleGrid(g, x, z)) >= body.level) return undefined;
  return { body: b, ...body, surface: body.level };
}
