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
 * Continuous stand albedo for an overhead quad.
 * The vertex colour jumps on a tile edge; this field does not, because it is only a function of metres.
 * The three colours sit in the spruce albedo range (MODIS boreal canopy, a few percent).
 * Fen is the wet hollow, conifer the closed stand, leaf the broadleaf patch.
 * Sentinel-2 cloudless (EOX, CC BY 4.0) shows those as separate patches, not one olive.
 */
export const OVERHEAD_STAND = {
  conifer: [0.020, 0.034, 0.016],
  leaf: [0.055, 0.086, 0.030],
  fen: [0.090, 0.062, 0.028],
} as const;

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
