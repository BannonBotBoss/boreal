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
export function coverSampleLatLon(lat: number, lon: number, dir?: Vec3, planet: Planet = planetFor(WORLD_SEED)): CoverSample {
  const d = dir ?? fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180);
  const s = planet.sampleSurface(d);
  const { water, elevM } = groundForCover(s, sampleDem(lat, lon));
  const coast = liveCoastM(lat, lon);
  const vegetation = samplePhotoVegetation(lat, lon) ?? vegetationWeight(s, d, coast);
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
  const planet = planetFor(WORLD_SEED);
  // Same direction the HUD uses: the landed frame off home, the seeded home frame otherwise.
  const dir = Number.isFinite(SITE.latDeg) ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const ll = toLatLon(dir);
  return coverSampleLatLon(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, dir, planet);
}

/**
 * The flat open-water plane (the teal sheet under every chunk) is drawn only when this
 * sample calls the point water. A Kenora depression under a dry prairie sample is not a lake.
 */
export function drawOpenWater(x: number, z: number) {
  return coverSampleAt(x, z).water;
}
