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
