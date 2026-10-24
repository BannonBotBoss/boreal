/** Physical visibility gate for globe detail (Matt: "how close is close enough? use real numbers").
 *  Smallest resolvable size s = range x theta, theta = max(pixel angle, eye acuity); pixel angle = 2 tan(fov/2) / screen height.
 *  A feature (layer) draws once its characteristic size spans >= ON_PX pixels (fades in from 1 px).
 *  Acuity: ~1 arcmin = 2.9e-4 rad (Snellen 20/20; Westheimer, "Visual acuity", Adler's Physiology of the Eye).
 *  Sanity checks (tests): ISS at ~400 km: 400 km x 2.9e-4 = ~116 m, matching the ~100 m features crews report by eye
 *  (NASA Crew Earth Observations, eol.jsc.nasa.gov); DSCOVR EPIC: 2048 px over the disk from ~1.5e6 km = ~10 km/px at
 *  nadir (NASA EPIC, epic.gsfc.nasa.gov/about). Refs in refs/orbit-reference/SOURCES.md. */
export const EYE_ACUITY_RAD = 2.9e-4;
export const ON_PX = 2;
/** Characteristic (smallest typical) horizontal size, metres, and the source. */
export const FEATURE_SIZE_M = {
  cloudSystem: { m: 1_000_000, src: 'synoptic cyclones / ITCZ bands ~1000 km (Holton & Hakim, An Intro to Dynamic Meteorology, ch. 1 scales)' },
  snowCover: { m: 100_000, src: 'regional snowline / snow-extent patches ~100 km (NOAA IMS 4 km product resolves them; Helfrich et al. 2007)' },
  seaIceEdge: { m: 100_000, src: 'marginal ice zone width ~100 km (Strong et al. 2017, Rem. Sens. Env., MIZ definition)' },
  lakes: { m: 10_000, src: 'large lakes >10 km (Messager et al. 2016 HydroLAKES size distribution)' },
  forest: { m: 1_000, src: 'forest stand / clearing patches ~1 km (Hansen et al. 2013 Landsat forest change)' },
  rivers: { m: 1_000, src: 'large river channels 1-10 km wide (Allen & Pavelsky 2018 GRWL)' },
  soilMoisture: { m: 2_000, src: 'wet/dry field-scale albedo patches ~1-2 km (Lobell & Asner 2002); invisible at full-disk scale (EPIC, 10 km/px)' },
} as const;
export type Feature = keyof typeof FEATURE_SIZE_M;

/** Radians per pixel, capped below by eye acuity. fovDeg: vertical field of view. */
export const pixelAngle = (fovDeg: number, hPx: number) => Math.max(2 * Math.tan(fovDeg * Math.PI / 360) / Math.max(1, hPx), EYE_ACUITY_RAD);
/** Smallest resolvable size (m) at `rangeM`. */
export const resolvableM = (rangeM: number, fovDeg: number, hPx: number) => rangeM * pixelAngle(fovDeg, hPx);
/** Range (m) at which `f` reaches ON_PX pixels: below this it is drawn fully. */
export const switchOnRange = (f: Feature, fovDeg: number, hPx: number) => FEATURE_SIZE_M[f].m / (ON_PX * pixelAngle(fovDeg, hPx));
/** 0..1 weight: 0 below 1 px, 1 at >= ON_PX px (linear in pixels). */
export function visibleWeight(f: Feature, rangeM: number, fovDeg: number, hPx: number) {
  const px = FEATURE_SIZE_M[f].m / Math.max(1e-6, resolvableM(rangeM, fovDeg, hPx));
  return Math.min(1, Math.max(0, (px - 1) / (ON_PX - 1)));
}
