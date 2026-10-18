/**
 * Stage 3, surficial material (WORLD-STAGES.md), derived from the seed's stages 1-2. Nothing is placed. Per grid node:
 *  - slope S (world m/m, central differences on the stage-1 surface), TWI = ln(a / tan b) with a = upslope area per unit width
 *    (Beven & Kirkby 1979) in world units, flow distance to drainage D, and
 *  - HAND, height above the nearest drainage (Renno et al. 2008, Remote Sens. Environ. 112:3469; Nobre et al. 2011, J. Hydrol.
 *    404:13): follow D8 down to the first drainage cell (stage-2c channel, lake or open water) and take the height difference.
 *    Same definition as pysheds `Grid.compute_hand` (GPL-3, so implemented from the papers: one pass in ascending filled order,
 *    receivers first).
 *  - Landscape class: Gharari et al. 2011 (HESS 15:3275) model MSH, crisp form, best-fit thresholds S = 0.129 and HAND = 5.9 m:
 *    flat wetland (S < .129, H < 5.9), sloped wetland (S > .129, H < 5.9), hillslope (S > .129, H > 5.9), plateau (S < .129, H > 5.9).
 *  - Material, using the NOEGTS terrain units for the Kenora / Lake of the Woods map areas (Hallett & Roed 1980, NOEGTS 36):
 *    bedrock knobs RN (bare or thin patchy drift), ground moraine MG (thin till), glaciolacustrine plains LP (clay/silt, low ground
 *    near the big lakes), organic terrain OT (peat), minor glaciofluvial outwash GO (sand):
 *      hillslope -> bedrock; plateau -> thin till, but knob tops (highest HAND) -> bedrock and seeded outwash patches -> sand;
 *      sloped wetland -> thin till (slopewash); flat wetland -> peat where wet (TWI >= twiPeat, or a shallow filled depression),
 *      else clay if within clayBelowM of base water (Lake Agassiz / glacial Lake Kenora plains), else thin till.
 *    Bedrock exposure is calibrated to the reference: ESA WorldCover 2021 'grassland' + 'bare' (Shield outcrop with lichen/meadow)
 *    = 11.4 % of natural land in a 15 x 15 km window east of Kenora. Knob tops fill the share the hillslope rule leaves.
 * Thresholds marked [verify] are game choices; the Gharari values come from a 5 m DEM in Luxembourg, applied here to a 30 m grid.
 */
import { elevationGrid, flowGrid, lakeGrid, toWorld } from './elevation';
import { riverGrid } from './rivers';
import { hash, random } from '../../proc/rng';

export const SOIL = {
  slope: .129, hand: 5.9,           // Gharari et al. 2011 MSH best fit
  bedrockFrac: .114,                // WorldCover outcrop share (see header)
  twiPeat: 9,                       // [verify] TWI (ln m) above which a flat wetland is organic terrain
  clayBelowM: 12,                   // [verify] LP plains: low ground near base water (NOEGTS 36: relief < 15 m near Lake of the Woods)
  sandShare: .08,                   // [verify] share of plateaus on outwash (NOEGTS 36: GO 'small, thin' deposits)
};
export const SOIL_KINDS = ['bedrock', 'till', 'sand', 'clay', 'peat', 'water'] as const;
export type SoilKind = typeof SOIL_KINDS[number];
/** Per material: site wetness 0 dry - 1 wet (tree mix, ground moisture) and mineral depth to bedrock range (m).
 *  Depths: Shield thin till < 1 m (NOEGTS MG), outwash 1-5 m, glaciolacustrine clay 2-10 m, peat (CSSC Organic order >= 40 cm
 *  organic) over clay/till [verify ranges]. */
export const SOIL_PROPS: Record<SoilKind, { wet: number; depth: [number, number]; label: string }> = {
  bedrock: { wet: .05, depth: [.02, .1], label: 'bedrock outcrop (RN)' },
  till: { wet: .45, depth: [.15, 1], label: 'thin till over bedrock (MG)' },
  sand: { wet: .15, depth: [1.5, 5], label: 'outwash sand (GO)' },
  clay: { wet: .7, depth: [2, 10], label: 'glaciolacustrine clay (LP)' },
  peat: { wet: .95, depth: [1, 4], label: 'peat over clay/till (OT)' },
  water: { wet: 1, depth: [0, 0], label: 'water' },
};
export type Soils = { n: number; cell: number; kind: Uint8Array; slope: Float32Array; twi: Float32Array; hand: Float32Array; dist: Float32Array; landscape: Uint8Array; frac: Record<SoilKind, number>; ms: number };
const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
const cache = new Map<number, Soils>();
export function soilGrid(seed: number): Soils {
  let S = cache.get(seed); if (S) return S;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const g = elevationGrid(seed), f = flowGrid(seed), L = lakeGrid(seed), R = riverGrid(seed), n = g.n, N = n * n, cell = g.cell;
  const z = new Float32Array(N); for (let c = 0; c < N; c++) z[c] = toWorld(g, g.h[c]);
  const at = (i: number, j: number) => ((j % n) + n) % n * n + ((i % n) + n) % n;
  const slope = new Float32Array(N), twi = new Float32Array(N), hand = new Float32Array(N), dist = new Float32Array(N), kind = new Uint8Array(N), landscape = new Uint8Array(N);
  for (let c = 0; c < N; c++) { const i = c % n, j = (c / n) | 0, gx = (z[at(i + 1, j)] - z[at(i - 1, j)]) / (2 * cell), gz = (z[at(i, j + 1)] - z[at(i, j - 1)]) / (2 * cell);
    slope[c] = Math.hypot(gx, gz); twi[c] = Math.log(f.acc[c] * cell / Math.max(1e-3, slope[c])); }
  // HAND + flow distance: receivers have lower filled height, so ascending filled order visits each receiver first
  const drain = (c: number) => f.outlet[c] || L.id[c] >= 0 || R.channel[c] === 1, ref = new Float32Array(N), order = Uint32Array.from({ length: N }, (_, c) => c).sort((a, b) => f.filled[a] - f.filled[b]);
  for (const c of order) { const r = f.dir[c];
    if (drain(c) || r < 0) { ref[c] = toWorld(g, f.filled[c]); dist[c] = 0; }
    else { ref[c] = ref[r]; const d = ((r % n) - (c % n) + n + 1) % n - 1, e = (((r / n) | 0) - ((c / n) | 0) + n + 1) % n - 1; dist[c] = dist[r] + Math.hypot(d, e) * cell; }
    hand[c] = Math.max(0, z[c] - ref[c]); }
  // Gharari landscape: 0 flat wetland, 1 sloped wetland, 2 hillslope, 3 plateau
  const land: number[] = [];
  for (let c = 0; c < N; c++) { const steep = slope[c] > SOIL.slope, high = hand[c] > SOIL.hand; landscape[c] = high ? (steep ? 2 : 3) : (steep ? 1 : 0); if (!(f.outlet[c] || L.id[c] >= 0)) land.push(c); }
  let hill = 0; for (const c of land) if (landscape[c] === 2) hill++;
  const knobs = Math.max(0, Math.round(SOIL.bedrockFrac * land.length) - hill), plateaus = land.filter(c => landscape[c] === 3).sort((a, b) => hand[b] - hand[a]), knob = new Uint8Array(N);
  for (let k = 0; k < Math.min(knobs, plateaus.length); k++) knob[plateaus[k]] = 1;
  const outwash = lattice(seed, 8, n), sandCut = Float32Array.from(outwash).sort()[Math.floor(SOIL.sandShare * N)], lakeLevelBase = toWorld(g, g.pw);
  for (let c = 0; c < N; c++) {
    let k: SoilKind;
    if (f.outlet[c] || L.id[c] >= 0) k = 'water';
    else if (landscape[c] === 2 || knob[c]) k = 'bedrock';
    else if (landscape[c] === 3) k = outwash[c] < sandCut ? 'sand' : 'till';
    else if (landscape[c] === 1) k = 'till';
    else k = twi[c] >= SOIL.twiPeat || (f.filled[c] - g.h[c]) * g.k > .05 ? 'peat' : z[c] - lakeLevelBase < SOIL.clayBelowM ? 'clay' : 'till';
    kind[c] = SOIL_KINDS.indexOf(k);
  }
  const frac = Object.fromEntries(SOIL_KINDS.map(s => [s, 0])) as Record<SoilKind, number>; for (const c of land) frac[SOIL_KINDS[kind[c]]] += 1 / land.length;
  cache.set(seed, S = { n, cell, kind, slope, twi, hand, dist, landscape, frac, ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0 });
  return S;
}
/** Seeded, periodic, low-frequency value-noise patch field on the n×n node grid (smoothstep-bilinear over a period×period lattice). */
function lattice(seed: number, period: number, n: number) {
  const r = random(hash(`soils-outwash:${seed}`)), L = Float32Array.from({ length: period * period }, () => r()), v = new Float32Array(n * n);
  const s = (a: number, b: number) => L[(b % period) * period + (a % period)];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = i / n * period, y = j / n * period, xi = Math.floor(x), yi = Math.floor(y), u = x - xi, w = y - yi, su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
    v[j * n + i] = (s(xi, yi) * (1 - su) + s(xi + 1, yi) * su) * (1 - sw) + (s(xi, yi + 1) * (1 - su) + s(xi + 1, yi + 1) * su) * sw; }
  return v;
}
/** Material and indices at a point (nearest node; grid values sit on nodes as in sampleGrid). */
export function soilAt(seed: number, x: number, z: number) {
  const S = soilGrid(seed), n = S.n, i = ((Math.round(x / S.cell) % n) + n) % n, j = ((Math.round(z / S.cell) % n) + n) % n, c = j * n + i, kind = SOIL_KINDS[S.kind[c]], p = SOIL_PROPS[kind];
  const wet = Math.min(1, Math.max(0, p.wet + (S.twi[c] - 7) * .04)); // TWI nudges wetness within a class [verify]
  return { kind, label: p.label, wet, depth: p.depth, slope: S.slope[c], twi: S.twi[c], hand: S.hand[c], dist: S.dist[c], landscape: ['flat wetland', 'sloped wetland', 'hillslope', 'plateau'][S.landscape[c]] };
}
