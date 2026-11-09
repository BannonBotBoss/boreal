/**
 * Stand-scale colour of vegetated land.
 *
 * Sentinel-2 MSI samples the ground at 10 m (Drusch et al. 2012, Remote Sensing of Environment 120).
 * A boreal or prairie true-colour mosaic (EOX Sentinel-2 cloudless, CC BY 4.0, the tiles openTiles already fetches)
 * is not one albedo: stands and wetlands sit at tens to hundreds of metres.
 * The three waves are 40 m, 160 m and 640 m. The weights keep the mean near the vertex colour.
 * The globe tile shader and the skirt shader use the same waves and the same fen/leaf weights.
 */
import { hash2u } from '../../proc/rng';

export const MOSAIC_WAVE_M = [40, 160, 640] as const;
const WEIGHT = [0.5, 0.3, 0.2] as const;

function valueAt(x: number, z: number, wave: number, salt: number) {
  const fx = x / wave, fz = z / wave;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const u = fx - ix, v = fz - iz;
  const s = u * u * (3 - 2 * u), t = v * v * (3 - 2 * v);
  const h = (a: number, b: number) => hash2u(a, b, salt);
  return h(ix, iz) * (1 - s) * (1 - t) + h(ix + 1, iz) * s * (1 - t) + h(ix, iz + 1) * (1 - s) * t + h(ix + 1, iz + 1) * s * t;
}

/** 0..1. About one half, so the colour multipliers below average near 1. */
export function standField(x: number, z: number) {
  let u = 0;
  for (let i = 0; i < MOSAIC_WAVE_M.length; i++) u += valueAt(x, z, MOSAIC_WAVE_M[i], i + 7) * WEIGHT[i];
  return u;
}

/**
 * The stand mosaic is on whenever a 40 m cell is wider than about 2 px.
 * `detailStrength` is the globe tier's detail (0 at Minimum). It does not turn the mosaic off:
 * that gate left the drone over boreal as one green fill.
 */
export function standMosaicActive(detailStrength: number, metresPerPixel: number) {
  if (detailStrength < -1) return false;
  return 40 / Math.max(metresPerPixel, 1e-6) > 2;
}

export interface GroundFillStats { stdL: number; bins: number; black: number }

/**
 * A ground crop that is one colour, or a black canvas.
 * Calibrated on the 400 m boreal frame (one green: low luma spread, few bins)
 * and on a mottled stand field (spread and bins both higher).
 * The crop is the ground, not the HUD.
 */
export function flatGroundFill(s: GroundFillStats) {
  if (s.black >= 0.85 && s.stdL < 6) return true;
  // The 400 m boreal crop before the fix was one green: luma spread 0.3, two bins.
  // A stand mosaic on that same crop spreads both.
  return s.stdL < 2 && s.bins < 5;
}

/**
 * Crown clump at 12 m.
 * A closed boreal crown is a few metres across. Sentinel-2's 10 m pixel (Drusch et al. 2012)
 * still breaks a stand into clumps rather than one green. 12 m sits between one crown and that pixel.
 * 1 at a centre, 0 in a gap. A jittered grid, so it does not line up with a quadtree edge.
 */
export const CROWN_CELL_M = 12;

export function crownCover(x: number, z: number) {
  const cell = CROWN_CELL_M;
  const ix = Math.floor(x / cell), iz = Math.floor(z / cell);
  let best = 2;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cx = ix + a, cz = iz + b;
    const jx = (hash2u(cx, cz, 21) - 0.5) * 0.75;
    const jz = (hash2u(cx, cz, 22) - 0.5) * 0.75;
    const rad = 0.40 + 0.28 * hash2u(cx, cz, 23);
    const d = Math.hypot(x / cell - (cx + 0.5 + jx), z / cell - (cz + 0.5 + jz)) / rad;
    if (d < best) best = d;
  }
  return best >= 1 ? 0 : 1 - best;
}

/**
 * Daylight stand albedo for an overhead quad.
 * The vertex colour jumps on a tile edge; this field does not, because it is only a function of metres.
 *
 * These are not MODIS reflectance. The globe sun is intensity 3.2 with a hemisphere fill, and three's
 * Lambert divides by π (MeshStandardMaterial). An albedo of a few percent then tone-maps to sRGB luma
 * about 20 (measured on tasks/evidence/T-0184/after-globe-2000.png: mean luma 19.7, and the fen
 * 0.090, 0.062, 0.028 came out red). The numbers below are the linear albedos that the same lights
 * and ACES (exposure 1, the standalone globe) put near the EOX Sentinel-2 cloudless 2021 tile of
 * this region (52 N, 97 W, zoom 8, CC BY 4.0): mid land about sRGB 34, 43, 23. Conifer is that
 * mid green, leaf is the lighter aspen/birch patch, fen is brown-olive (red does not lead green).
 * Lake is the aerial water, darker than the canopy and blue, so a vertex lake stays a lake.
 */
export const OVERHEAD_STAND = {
  // Linear albedo under the globe sun (intensity 3.2, Lambert / π, ACES exposure 1).
  // The previous table was tuned so a zoom-8 tile's luma (~39) passed. A 2000 m
  // frame is about 1–3 m per pixel, and that table read as one dark green.
  // Crown is the shaded spruce; moss is the gap; leaf is aspen/birch; fen is brown.
  // Green channel is what luma sees. Crown and gap have to differ there, or a
  // 2000 m frame stays one bin. Crown is the shaded spruce; moss is the lit gap.
  conifer: [0.035, 0.055, 0.025],
  moss: [0.16, 0.22, 0.07],
  leaf: [0.20, 0.30, 0.08],
  fen: [0.20, 0.13, 0.05],
} as const;

/** Dark-blue lake albedo for the aerial band. Same lighting model as OVERHEAD_STAND.
 *  Darker than the canopy, and blue, so a shore is an edge. The 0.01 stored
 *  lake albedo tone-maps to black. */
export const OVERHEAD_LAKE = [0.025, 0.045, 0.12] as const;

export function overheadStand(x: number, z: number): [number, number, number] {
  const u = standField(x, z);
  const a = u < 0.46 ? OVERHEAD_STAND.fen : OVERHEAD_STAND.conifer;
  const b = u < 0.46 ? OVERHEAD_STAND.conifer : OVERHEAD_STAND.leaf;
  const t = u < 0.46 ? u / 0.46 : (u - 0.46) / 0.54;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Fen (browner) below the middle, broadleaf (greener) above it. Water is not passed in. */
export function landMosaic(x: number, z: number, rgb: readonly [number, number, number]): [number, number, number] {
  const u = standField(x, z);
  const fen = u < 0.5 ? (0.5 - u) / 0.5 : 0;
  const leaf = u > 0.5 ? (u - 0.5) / 0.5 : 0;
  return [
    Math.min(1, rgb[0] * (1 + 0.55 * fen + 0.15 * leaf)),
    Math.min(1, rgb[1] * (1 - 0.25 * fen + 0.45 * leaf)),
    Math.min(1, rgb[2] * (1 - 0.15 * fen - 0.05 * leaf)),
  ];
}
