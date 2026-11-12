/**
 * One cover sample for the HUD and the picture (D27).
 *
 * The landing report reads Sentinel-2 cloudless (EOX, CC BY 4.0, https://s2maps.eu) when a tile
 * is cached, otherwise the planet's vegetation weight, plus the Mapzen terrarium DEM
 * (openTiles.ts). coverKind then names the biome. The home longitude is seeded, not Kenora
 * (planet.ts), so that sample can be prairie while the Kenora stand and the open-water plane
 * are still drawn. This function is the sample both sides use.
 */
import { WORLD_SEED } from '../../core/world';
import { liveCoastM } from '../../core/planetWeather';
import { SITE, siteDirection } from '../../core/sitePhase';
import { TREE_BY_ID } from '../../core/treeSpecies';
import { coverKind, coverRow, coverTreeShare, type CoverKind } from './coverKind';
import { groundForCover, sampleDem, samplePhotoVegetation } from './openTiles';
import { PLANET, fromLatLon, planetFor, toLatLon, vegetationWeight, type Planet, type Vec3 } from './planet';

export interface CoverSample {
  lat: number;
  lon: number;
  elevM: number;
  vegetation: number;
  water: boolean;
  biome: CoverKind;
  coastM: number;
  /** Share of a closed stand this class keeps. Prairie is about 0.05. Boreal is 1. */
  treeShare: number;
  /** Cover-row stems per hectare. Zero on water, ice and rock. */
  stemsPerHa: number;
  /** Cover-row plant height (m). Zero on water, ice and rock. */
  heightM: number;
  /**
   * Multiply a black-spruce mesh by this. The species table's mature height is 9–15 m
   * (Viereck & Johnston 1990, Silvics of North America, Picea mariana). A shorter cover
   * row is not that canopy.
   */
  scaleMul: number;
}

const SPRUCE = TREE_BY_ID['black-spruce'].height;
const SPRUCE_MIN_M = SPRUCE[0];
const SPRUCE_MID_M = (SPRUCE[0] + SPRUCE[1]) / 2;

/** Geographic sample. `dir` defaults to the lat/lon direction. Pass the planet the HUD uses. */
export function coverSampleLatLon(lat: number, lon: number, dir?: Vec3, planet: Planet = planetFor(WORLD_SEED, undefined, '', true)): CoverSample {
  const d = dir ?? fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180);
  const s = planet.sampleSurface(d);
  const { water, elevM } = groundForCover(s, sampleDem(lat, lon));
  const coast = liveCoastM(lat, lon);
  // Open water has no canopy. A blue Sentinel-2 pixel's green-red index starts at 0.55 and read as 0.92 vegetation on the Pacific drop.
  const vegetation = water ? 0 : (samplePhotoVegetation(lat, lon) ?? vegetationWeight(s, d, coast));
  const biome = coverKind(lat, elevM, vegetation, water, coast);
  const row = coverRow(lat, lon, elevM, vegetation, water, coast);
  const heightM = row.heightM;
  const scaleMul = heightM > 0 && heightM < SPRUCE_MIN_M ? heightM / SPRUCE_MID_M : 1;
  return {
    lat, lon, elevM, vegetation, water, biome,
    coastM: coast ?? NaN,
    treeShare: coverTreeShare(biome),
    stemsPerHa: row.stemsPerHa,
    heightM,
    scaleMul,
  };
}

/** The sample under a game-local point, the same frame landingContext uses. */
export function coverSampleAt(x: number, z: number): CoverSample {
  const planet = planetFor(WORLD_SEED, undefined, '', true);
  // Same direction the HUD uses: the landed frame off home, the seeded home frame otherwise.
  const dir = Number.isFinite(SITE.latDeg) ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const ll = toLatLon(dir);
  return coverSampleLatLon(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, dir, planet);
}

/**
 * The flat open-water plane (the teal sheet under every chunk) is drawn only when this
 * sample calls the point water. A Kenora depression under a dry prairie sample is not a lake.
 * The staged lake and river sheet is not this plane. buildScene mounts that sheet whenever
 * the terrain job produced it.
 */
export function drawOpenWater(x: number, z: number) {
  return coverSampleAt(x, z).water;
}

/** Vegetation bins in the cover tier key. The old key was floor(vegetation * 10). */
export const VEG_DECILES = 10;
/**
 * Deadband past a decile edge, as a vegetation fraction.
 * A Schmitt trigger (Schmitt 1938, J. Sci. Instrum. 15:24) stays put while the
 * input sits on the threshold, so the output does not chatter.
 * The bin width is 1/10. 0.02 is one fifth of that bin: the same fraction
 * WOLF_LOD.hyst (0.1) is of the 0.5 share threshold in gaitLod.ts pickLevel.
 */
export const VEG_HYST = 0.02;

/** Hold the previous decile until vegetation has cleared the shared edge by VEG_HYST.
 *  Pure, same shape as selectGait: one step per crossed edge, and a step only
 *  when the sample is past the deadband. The first call (no previous) takes the raw bin. */
export function holdVegetationDecile(vegetation: number, prev?: number): number {
  const v = Math.min(1, Math.max(0, vegetation));
  const raw = Math.min(VEG_DECILES - 1, Math.floor(v >= 1 ? VEG_DECILES - 1e-6 : v * VEG_DECILES));
  if (prev === undefined || !Number.isInteger(prev)) return raw;
  let held = Math.min(VEG_DECILES - 1, Math.max(0, prev));
  if (held === raw) return held;
  const dir = raw > held ? 1 : -1;
  for (let k = 0; k < VEG_DECILES && held !== raw; k++) {
    const boundary = (dir > 0 ? held + 1 : held) / VEG_DECILES;
    if (dir > 0) {
      if (v + 1e-12 >= boundary + VEG_HYST) held += 1;
      else break;
    } else if (v < boundary - VEG_HYST) held -= 1;
    else break;
  }
  return held;
}

/** Biome, water and the held vegetation decile. buildScene and the far filler share this string. */
export function coverTierToken(biome: string, water: boolean, vegetation: number, prevDecile?: number) {
  const decile = holdVegetationDecile(vegetation, prevDecile);
  return { decile, token: `${biome}:${water ? 1 : 0}:${decile}` };
}
