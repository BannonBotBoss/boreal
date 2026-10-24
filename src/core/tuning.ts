/**
 * Shared world/behaviour tuning (Grok Bot). Terrain-height thresholds were scattered across 6 files with 5 values;
 * they live here now with their ORIGINAL values, so nothing plays differently. Unifying them is a later, deliberate step.
 */
import { K } from './constants';
export const LEVEL = {
  /** Height of the flat water plane drawn in every chunk. */
  waterSurface: -.25,
  /** Dry-land line: objects, forage and hares only spawn above it; terrain below it is coloured as shore. */
  shore: .5,
  /** Terrain above this is coloured as upland rock. */
  upland: 3.3,
  /** Deer will not step below this (deep water); ambient water sound counts points below it. */
  deerWater: .1,
  /** The autonomous wolf will not step below this. */
  wolfWater: .2,
  /** Hares turn back below this. */
  hareWater: .15,
};
export const BLOCK = {
  /** Deer: max height change per step and spruce-trunk clearance (m). */
  deer: { step: .35, trunk: .6 },
  /** Autonomous wolf: max height change per probe and spruce/person clearance (m). */
  wolf: { step: .45, trunk: .7 },
};
/** Physical constants (SI). Gravity is DERIVED from these in proc/physics.ts; never write a literal g. */
export const PHYS = {
  get G() { return K.G; },  // live from core/constants (CODATA 2018; locked unless unlocked by its test)
  get EARTH_MASS() { return K.M_earth; }, // GM_earth (IERS/WGS84, fixed) ÷ G, core/constants
  get EARTH_RADIUS() { return K.R_earth_mean; }, // IUGG mean radius R1 (Moritz 2000), core/constants
  /** Share of a crown's cone that is wood + foliage (the rest is air); materials/densities live in core/materials.ts. */
  crownFill: .0015, // crown tissue volume share → crown bulk density ≈ 0.9 kg/m³ (foliage + twigs 0.5–1 kg/m³: Waring & Running 2007) [verify]; was .08 (≈ 50 kg/m³, too dense)
  /** Muscle force ~ k * m^(2/3) (so heavier animals accelerate/turn slower); k calibrated so the wolf keeps today's feel. */
  wolfAccel: 30, // game calibration (keeps today's feel), not a measurement
  /** Claude's jump lasts 0.85 s (animalBehavior); the ballistic arc that fits it gives launch/landing speed. */
  jumpSeconds: .85, // Claude's jump duration in animalBehavior.ts
};
