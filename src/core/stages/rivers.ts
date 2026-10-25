/**
 * Stage 2c, rivers (WORLD-STAGES.md step 6), derived entirely from the seed's stage-1 grid and stage-2a flow. Nothing is placed.
 *  - Channel extraction: cells whose upslope area >= RIVER.initKm2 are channel cells (threshold extraction, as
 *    WhiteboxTools ExtractStreams / pysheds extract_river_network; Montgomery & Dietrich 1988 channel initiation).
 *  - Strahler order (Strahler 1957): faithful port of xarray-spatial `_strahler_cpu` (MIT, Python/numba,
 *    xrspatial/hydro/stream_order_d8.py @ main 2026-10): Kahn BFS among channel cells; headwaters = 1; a cell takes the max
 *    inflowing order, +1 when >= 2 inflows share that max. Changes: D8 receivers are flat indices on our wrapping torus
 *    (flow.ts) instead of ESRI codes on a bounded raster; Uint8 storage. Lake cells stay IN the network for ordering (so order
 *    survives a lake) but are not drawn or carved (the lake sheet is the water there).
 *  - Bankfull hydraulic geometry from drainage area, Laurentian Upland (the US side of the Canadian Shield, incl. the BWCA next
 *    to Kenora): w = 4.15 A^0.308 m, d = 0.31 A^0.202 m, A in km^2 (Bieger, Rathjens, Allen & Arnold 2015, JAWRA 51(3):842,
 *    via FluvialGeomorph/RegionalCurve regional_curve_equations.csv). Fitted on 16.6-366 km^2; smaller basins extrapolate [verify].
 *  - Velocity: Manning v = R^(2/3) S^(1/2) / n with R ~ d and n = 0.035 (clean winding natural channel; Chow 1959, Table 5-6),
 *    S from the filled surface in game metres. It drives the shader's flow scrolling and foam only.
 *  - Carving is consistent with Priority-Flood: the water surface follows the FILLED surface (strictly decreasing downstream
 *    along D8, flow.ts), so every river runs downhill and meets its lake at the lake's own level. The terrain is only ever
 *    lowered (min), as a parabolic bed inside the banks and a sloped bank blended back to the original surface.
 *  - T-0029: a Priority-Flood residual deeper than the freeboard on a channel (Barnes, Lehman & Mulla 2014, Computers &
 *    Geosciences 62:117-127) is standing water at the spill, not a narrow sheet above the meadow. Those cells are ponds
 *    (why: filled -> ponded -> spilled) and are not drawn as channels. A drawn channel whose surface would still stand
 *    above unconfined ground is breached: the surface is lowered to that ground (Lindsay 2016, Hydrological Processes
 *    30:846-857, the breaching idea; no Whitebox code is ported). Slope and speed stay on the filled surface (T-0030).
 *  - Centrelines are the D8 segments between grid nodes (same node layout as sampleGrid), evaluated per query point, so rivers
 *    are continuous across chunks at any terrain resolution (Red Blob mapgen4 draws rivers per flow edge the same way, with
 *    width ~ sqrt(flow); we use the cited regional curve instead).
 */
import type { Flow } from './flow';
import { elevationGrid, flowGrid, lakeAt, lakeGrid, sampleGrid, toWorld, type Grid } from './elevation';
import { surfaceDetail } from '../surface';
import { LEVEL } from '../tuning';

export const RIVER = {
  /** Channel initiation area (km^2): ~0.5 km^2 for humid boreal Shield terrain (WORLD-STAGES.md) [verify]. */
  initKm2: .5,
  wA: 4.15, wB: .308, dA: .31, dB: .202, // Bieger et al. 2015, Laurentian Upland
  manningN: .035,                        // Chow 1959
  /** Water surface sits this far below the filled surface (game m) so banks show. */
  freeboard: .12,
  /** Bank: carved slope (rise/run) and width as a multiple of the half-width (min 2 m). */
  bankSlope: .18, bankK: 1.2,
};
/** contained.ts counts a side as open when the surface stands more than this far (m) above the ground there. */
const OPEN_M = .02;
/** A river pond's causal chain (T-0029): the pit was filled to its spill, so the channel ponds, and the pond spills at the outlet. */
export const POND_WHY = ['filled', 'ponded', 'spilled'] as const;
export type PondWhy = typeof POND_WHY;
export type Rivers = { n: number; cell: number; channel: Uint8Array; drawn: Uint8Array; order: Uint8Array; areaKm2: Float32Array; width: Float32Array; depth: Float32Array; /** Max water surface (m) on the segment that leaves this cell. Infinity: no breach. */ cap: Float32Array; maxOrder: number; ms: number };
export type RiverPonds = { id: Int32Array; bodies: { cells: number; areaHa: number; level: number; maxDepth: number; kind: 'pond' | 'lake'; why: PondWhy }[] };

/** Channel cells, Strahler order and hydraulic geometry over a flow grid. `wet(c)` marks lake cells (kept for order, not drawn). */
export function extractRivers(f: Flow, wet: (c: number) => boolean = () => false): Rivers {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), n = f.n, N = n * n, km2 = f.cell * f.cell / 1e6;
  const channel = new Uint8Array(N), drawn = new Uint8Array(N), order = new Uint8Array(N), inDeg = new Int32Array(N), maxIn = new Uint8Array(N), cntMax = new Uint8Array(N);
  const areaKm2 = new Float32Array(N), width = new Float32Array(N), depth = new Float32Array(N), cap = new Float32Array(N);
  cap.fill(Infinity);
  for (let c = 0; c < N; c++) { areaKm2[c] = f.acc[c] * km2; if (!f.outlet[c] && areaKm2[c] >= RIVER.initKm2) { channel[c] = 1; drawn[c] = wet(c) ? 0 : 1; } }
  // _strahler_cpu: in-degrees among channel cells
  for (let c = 0; c < N; c++) if (channel[c]) { const r = f.dir[c]; if (r >= 0 && channel[r]) inDeg[r]++; }
  const queue = new Int32Array(N); let head = 0, tail = 0, maxOrder = 0;
  for (let c = 0; c < N; c++) if (channel[c] && inDeg[c] === 0) { order[c] = 1; queue[tail++] = c; } // headwaters
  while (head < tail) {
    const c = queue[head++], r = f.dir[c]; if (r < 0 || !channel[r]) continue;
    const o = order[c]; if (o > maxIn[r]) { maxIn[r] = o; cntMax[r] = 1; } else if (o === maxIn[r]) cntMax[r]++;
    if (--inDeg[r] === 0) { order[r] = cntMax[r] >= 2 ? maxIn[r] + 1 : maxIn[r]; queue[tail++] = r; }
  }
  for (let c = 0; c < N; c++) if (channel[c]) { maxOrder = Math.max(maxOrder, order[c]); width[c] = RIVER.wA * areaKm2[c] ** RIVER.wB; depth[c] = RIVER.dA * areaKm2[c] ** RIVER.dB; }
  return { n, cell: f.cell, channel, drawn, order, areaKm2, width, depth, cap, maxOrder, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}

/** 8-connected torus neighbours (D8, matching the channel step). */
function nbs8(n: number, c: number): number[] {
  const x = c % n, y = (c / n) | 0, out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) out.push(((y + dy + n) % n) * n + (x + dx + n) % n);
  return out;
}
/** Depressions the channel crosses. A residual deeper than the freeboard is below the spill (Barnes et al. 2014).
 *  Only a component that contains a channel cell becomes a pond; off-channel pits stay peat (stage 3). */
function labelRiverPonds(g: Grid, f: Flow, R: Rivers, lakeId: Int32Array): RiverPonds {
  const n = R.n, N = n * n, id = new Int32Array(N).fill(-1), k = g.k;
  const pit = (c: number) => lakeId[c] < 0 && !f.outlet[c] && (f.filled[c] - g.h[c]) * k > RIVER.freeboard;
  const bodies: RiverPonds['bodies'] = [];
  for (let c = 0; c < N; c++) if (pit(c) && R.channel[c] && id[c] < 0) {
    const b = bodies.length, stack = [c]; id[c] = b; let cells = 0, level = -Infinity, maxDepth = 0;
    while (stack.length) {
      const q = stack.pop()!; cells++; level = Math.max(level, toWorld(g, f.filled[q])); maxDepth = Math.max(maxDepth, (f.filled[q] - g.h[q]) * k);
      for (const m of nbs8(n, q)) if (id[m] < 0 && pit(m)) { id[m] = b; stack.push(m); }
    }
    const areaHa = cells * g.cell * g.cell / 1e4;
    bodies.push({ cells, areaHa, level, maxDepth, kind: areaHa < 2 ? 'pond' : 'lake', why: POND_WHY });
  }
  for (let c = 0; c < N; c++) if (id[c] >= 0) R.drawn[c] = 0; // the pond sheet is the water; the channel is not drawn through it
  return { id, bodies };
}

const cache = new Map<number, Rivers>();
const pondCache = new Map<number, RiverPonds>();
/** Stage 2c for the seed (cached). Lake cells and channel-crossing depressions are not drawn. */
export function riverGrid(seed: number): Rivers {
  let R = cache.get(seed); if (R) return R;
  const g = elevationGrid(seed), f = flowGrid(seed), L = lakeGrid(seed);
  R = extractRivers(f, c => L.id[c] >= 0);
  const ponds = labelRiverPonds(g, f, R, L.id);
  cache.set(seed, R); pondCache.set(seed, ponds); // riverAt / pondAt during the breach read this cache
  breachUnconfined(seed, R, f);
  return R;
}
/** Ponds on channel-crossing depressions (cached with the river grid). */
export function riverPondGrid(seed: number): RiverPonds {
  let P = pondCache.get(seed); if (P) return P;
  riverGrid(seed); return pondCache.get(seed)!;
}
/** Water surface of a river pond at (x, z), else undefined. Same shoreline rule as lakeAt: a corner node in the body,
 *  and only where the spill level is above the bilinear ground. */
export function pondAt(seed: number, x: number, z: number) {
  const g = elevationGrid(seed), P = riverPondGrid(seed), n = g.n, i0 = Math.floor(x / g.cell), j0 = Math.floor(z / g.cell); let b = -1;
  for (let k = 0; k < 4 && b < 0; k++) { const i = (((i0 + (k & 1)) % n) + n) % n, j = (((j0 + (k >> 1)) % n) + n) % n; b = P.id[j * n + i]; }
  if (b < 0) return undefined; const body = P.bodies[b]; if (toWorld(g, sampleGrid(g, x, z)) >= body.level) return undefined;
  return { body: b, ...body, surface: body.level };
}
export type RiverHit = { d: number; half: number; bank: number; surface: number; depth: number; order: number; dirX: number; dirZ: number; speed: number; areaKm2: number };
/** Nearest river segment influencing (x, z) (game metres), or undefined. The bank zone is d in [half, half + bank]. */
export function riverAt(seed: number, x: number, z: number): RiverHit | undefined {
  const R = riverGrid(seed), g = elevationGrid(seed), f = flowGrid(seed), n = R.n, s = R.cell, fi = Math.floor(x / s), fj = Math.floor(z / s);
  let best: RiverHit | undefined, bestEdge = Infinity;
  for (let dj = -1; dj <= 2; dj++) for (let di = -1; di <= 2; di++) {
    const i = fi + di, j = fj + dj, c = ((j % n) + n) % n * n + ((i % n) + n) % n; if (!R.drawn[c]) continue;
    const r = f.dir[c]; if (r < 0) continue;
    const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1; // wrapped D8 offset in {-1,0,1}
    const ax = i * s, az = j * s, ex = ox * s, ez = oz * s, len2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2)), px = x - ax - t * ex, pz = z - az - t * ez, d = Math.hypot(px, pz);
    const wr = R.channel[r] ? R.width[r] : R.width[c], half = Math.min(.4 * s, (R.width[c] + (wr - R.width[c]) * t) / 2);
    const bank = Math.min(.5 * s, Math.max(2, half * RIVER.bankK)), edge = d - half; if (edge > bank || edge >= bestEdge) continue;
    const sc = toWorld(g, f.filled[c]), sr = toWorld(g, f.filled[r]), len = Math.sqrt(len2), depth = R.depth[c] + ((R.channel[r] ? R.depth[r] : R.depth[c]) - R.depth[c]) * t;
    const slope = Math.max(1e-5, (sc - sr) / len);
    const fb = RIVER.freeboard * (1 - t + (R.drawn[r] ? t : 0)); // taper to 0 where the river enters a lake/open water so the surfaces meet
    const filledS = sc + (sr - sc) * t - fb;
    bestEdge = edge; best = { d, half, bank, surface: Math.min(filledS, R.cap[c]), depth, order: R.order[c], dirX: ex / len, dirZ: ez / len,
      speed: Math.min(3, depth ** (2 / 3) * Math.sqrt(slope) / RIVER.manningN), areaKm2: R.areaKm2[c] };
  }
  return best;
}
/** Terrain after channel carving: only ever lowers h (parabolic bed, sloped bank, smooth blend back at the bank's outer edge). */
export function carve(h: number, r: RiverHit) {
  const bed = r.d < r.half ? r.surface - r.depth * (1 - (r.d / r.half) ** 2) : r.surface + (r.d - r.half) * RIVER.bankSlope;
  const u = Math.max(0, Math.min(1, ((r.d - r.half) / r.bank - .6) / .4)), blend = u * u * (3 - 2 * u);
  return Math.min(h, bed) * (1 - blend) + h * blend;
}

/** Ground the containment audit sees: bilinear stage-1 plus micro-detail, carved when a channel covers the point. */
function auditGround(seed: number, x: number, z: number) {
  const g = elevationGrid(seed), h0 = toWorld(g, sampleGrid(g, x, z)) + surfaceDetail(x, z) * .5, rv = riverAt(seed, x, z);
  return rv ? carve(h0, rv) : h0;
}
/** True when contained.ts would ignore this side (already water: lake, pond, channel, or below the base plane). */
function alreadyWater(seed: number, x: number, z: number) {
  if (lakeAt(seed, x, z) || pondAt(seed, x, z)) return true;
  const rv = riverAt(seed, x, z);
  return (!!rv && rv.d < rv.half) || auditGround(seed, x, z) < LEVEL.waterSurface;
}
/** Lower each drawn segment's surface to the lower unconfined bank (Lindsay 2016, applied per segment, not a Whitebox port).
 *  Repeats until the cap stops falling: carving a neighbour can lower the bank this segment is measured against. */
function breachUnconfined(seed: number, R: Rivers, f: Flow) {
  const n = R.n, s = R.cell, N = n * n;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let c = 0; c < N; c++) {
      if (!R.drawn[c]) continue; const r = f.dir[c]; if (r < 0) continue;
      const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1;
      const len = Math.hypot(ox, oz) * s; if (!(len > 0)) continue;
      const t = .5, x = ((c % n) + ox * t) * s, z = (((c / n) | 0) + oz * t) * s;
      const wr = R.channel[r] ? R.width[r] : R.width[c], half = Math.min(.4 * s, (R.width[c] + (wr - R.width[c]) * t) / 2);
      const bank = Math.min(.5 * s, Math.max(2, half * RIVER.bankK)), off = half + bank + 1, dirX = ox * s / len, dirZ = oz * s / len;
      let cap = Infinity;
      for (const side of [1, -1]) {
        const px = x - dirZ * side * off, pz = z + dirX * side * off;
        if (alreadyWater(seed, px, pz)) continue;
        cap = Math.min(cap, auditGround(seed, px, pz) + OPEN_M - 1e-4);
      }
      if (cap < R.cap[c] - 1e-6) { R.cap[c] = cap; moved = true; }
    }
    if (!moved) break;
  }
}
