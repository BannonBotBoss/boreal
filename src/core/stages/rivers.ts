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
 *  - Velocity: Manning v = R^(2/3) S^(1/2) / n with R ~ d (wide shallow channel). n is Chow's 0.035 below
 *    Jarrett's range and Jarrett's high-gradient n at and above it (channelSpeed). No speed cap. The speed
 *    scrolls the water texture. Foam is not this speed: it is the water×rock transaction in channelRough.ts.
 *  - Carving is consistent with Priority-Flood: the water surface follows the FILLED surface (strictly decreasing downstream
 *    along D8, flow.ts), so every river runs downhill and meets its lake at the lake's own level. The terrain is only ever
 *    lowered (min), as a parabolic bed inside the banks and a sloped bank blended back to the original surface.
 *  - Centrelines are the D8 segments between grid nodes (same node layout as sampleGrid), evaluated per query point, so rivers
 *    are continuous across chunks at any terrain resolution (Red Blob mapgen4 draws rivers per flow edge the same way, with
 *    width ~ sqrt(flow); we use the cited regional curve instead).
 */
import type { Flow } from './flow';
import { elevationGrid, flowGrid, lakeGrid, toWorld } from './elevation';

export const RIVER = {
  /** Channel initiation area (km^2): ~0.5 km^2 for humid boreal Shield terrain (WORLD-STAGES.md) [verify]. */
  initKm2: .5,
  wA: 4.15, wB: .308, dA: .31, dB: .202, // Bieger et al. 2015, Laurentian Upland
  manningN: .035,                        // Chow 1959, Table 5-6: clean, winding, some pools and shoals (quoted range 0.033–0.045). Used only below Jarrett's fit.
  /** Jarrett 1984, J. Hydraulic Eng. 110(11):1519: n = 0.39 S^0.38 R_ft^-0.16, fitted for S > 0.002. 1 ft = 0.3048 m. */
  jarrettMinS: .002, jarrettA: .39, jarrettB: .38, jarrettC: -.16, footM: .3048,
  /** Water surface sits this far below the filled surface (game m) so banks show. */
  freeboard: .12,
  /** Bank: carved slope (rise/run) and width as a multiple of the half-width (min 2 m). */
  bankSlope: .18, bankK: 1.2,
};
export type Rivers = { n: number; cell: number; channel: Uint8Array; drawn: Uint8Array; order: Uint8Array; areaKm2: Float32Array; width: Float32Array; depth: Float32Array; maxOrder: number; ms: number };

/** Channel cells, Strahler order and hydraulic geometry over a flow grid. `wet(c)` marks lake cells (kept for order, not drawn). */
export function extractRivers(f: Flow, wet: (c: number) => boolean = () => false): Rivers {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now(), n = f.n, N = n * n, km2 = f.cell * f.cell / 1e6;
  const channel = new Uint8Array(N), drawn = new Uint8Array(N), order = new Uint8Array(N), inDeg = new Int32Array(N), maxIn = new Uint8Array(N), cntMax = new Uint8Array(N);
  const areaKm2 = new Float32Array(N), width = new Float32Array(N), depth = new Float32Array(N);
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
  return { n, cell: f.cell, channel, drawn, order, areaKm2, width, depth, maxOrder, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 };
}

const cache = new Map<number, Rivers>();
/** Stage 2c for the seed (cached). Lake cells are the stage-2b water bodies. */
export function riverGrid(seed: number): Rivers {
  let R = cache.get(seed); if (R) return R;
  const L = lakeGrid(seed); cache.set(seed, R = extractRivers(flowGrid(seed), c => L.id[c] >= 0)); return R;
}
export type RiverHit = {
  d: number; half: number; bank: number; surface: number; depth: number; order: number; dirX: number; dirZ: number;
  speed: number; areaKm2: number; slope: number; along: number; len: number; ax: number; az: number;
};
/** One drawn D8 segment at unwrapped grid node (i, j). Slope and the node position are the same ones riverAt uses. */
export function segmentGeom(seed: number, i: number, j: number) {
  const R = riverGrid(seed), f = flowGrid(seed), g = elevationGrid(seed), n = R.n, s = R.cell;
  const c = ((j % n) + n) % n * n + ((i % n) + n) % n; if (!R.drawn[c]) return undefined;
  const r = f.dir[c]; if (r < 0) return undefined;
  const ox = ((r % n) - (c % n) + n + 1) % n - 1, oz = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1;
  const ax = i * s, az = j * s, ex = ox * s, ez = oz * s, len2 = ex * ex + ez * ez; if (!(len2 > 0)) return undefined;
  const len = Math.sqrt(len2), surface0 = toWorld(g, f.filled[c]), surface1 = toWorld(g, f.filled[r]);
  return {
    c, ax, az, ex, ez, len, dirX: ex / len, dirZ: ez / len,
    slope: Math.max(1e-5, (surface0 - surface1) / len), surface0, surface1,
    depth0: R.depth[c], depth1: R.channel[r] ? R.depth[r] : R.depth[c],
    width0: R.width[c], width1: R.channel[r] ? R.width[r] : R.width[c],
    order: R.order[c], areaKm2: R.areaKm2[c], drawnR: !!R.drawn[r],
  };
}
/** Manning n. Chow's low-gradient value below S = 0.002; Jarrett's high-gradient n at and above it (R in feet). */
export function roughnessN(slope: number, depth: number): number {
  if (!(slope >= RIVER.jarrettMinS) || !(depth > 0)) return RIVER.manningN;
  return RIVER.jarrettA * slope ** RIVER.jarrettB * (depth / RIVER.footM) ** RIVER.jarrettC;
}
/** Manning velocity (m/s). Wide-channel R ~ depth. Not capped: Jarrett's streams are not limited at 3 m/s. */
export function channelSpeed(depth: number, slope: number): number {
  const n = roughnessN(depth > 0 ? slope : 0, depth);
  if (!(n > 0) || !(depth > 0) || !(slope > 0)) return 0;
  return depth ** (2 / 3) * Math.sqrt(slope) / n;
}
/** Nearest river segment influencing (x, z) (game metres), or undefined. The bank zone is d in [half, half + bank]. */
export function riverAt(seed: number, x: number, z: number): RiverHit | undefined {
  const R = riverGrid(seed), s = R.cell, fi = Math.floor(x / s), fj = Math.floor(z / s);
  let best: RiverHit | undefined, bestEdge = Infinity;
  for (let dj = -1; dj <= 2; dj++) for (let di = -1; di <= 2; di++) {
    const seg = segmentGeom(seed, fi + di, fj + dj); if (!seg) continue;
    const t = Math.max(0, Math.min(1, ((x - seg.ax) * seg.ex + (z - seg.az) * seg.ez) / (seg.len * seg.len)));
    const px = x - seg.ax - t * seg.ex, pz = z - seg.az - t * seg.ez, d = Math.hypot(px, pz);
    const half = Math.min(.4 * s, (seg.width0 + (seg.width1 - seg.width0) * t) / 2);
    const bank = Math.min(.5 * s, Math.max(2, half * RIVER.bankK)), edge = d - half; if (edge > bank || edge >= bestEdge) continue;
    const depth = seg.depth0 + (seg.depth1 - seg.depth0) * t;
    const fb = RIVER.freeboard * (1 - t + (seg.drawnR ? t : 0)); // taper to 0 where the river enters a lake/open water so the surfaces meet
    bestEdge = edge; best = {
      d, half, bank, surface: seg.surface0 + (seg.surface1 - seg.surface0) * t - fb, depth, order: seg.order,
      dirX: seg.dirX, dirZ: seg.dirZ, speed: channelSpeed(depth, seg.slope), areaKm2: seg.areaKm2, slope: seg.slope,
      along: t * seg.len, len: seg.len, ax: seg.ax, az: seg.az,
    };
  }
  return best;
}
/** Terrain after channel carving: only ever lowers h (parabolic bed, sloped bank, smooth blend back at the bank's outer edge). */
export function carve(h: number, r: RiverHit) {
  const bed = r.d < r.half ? r.surface - r.depth * (1 - (r.d / r.half) ** 2) : r.surface + (r.d - r.half) * RIVER.bankSlope;
  const u = Math.max(0, Math.min(1, ((r.d - r.half) / r.bank - .6) / .4)), blend = u * u * (3 - 2 * u);
  return Math.min(h, bed) * (1 - blend) + h * blend;
}
