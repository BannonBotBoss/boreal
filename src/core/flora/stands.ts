/**
 * Tree density toward real Kenora-area boreal stands (Grok Bot). The tree ENTITIES (core/world + core/population) stay at the
 * generator's ~60-290 trees/ha for gameplay, collision and chunk build cost; render/flora/fartrees tops the drawn density up
 * with look-only trees beyond the near ring, placed here as a pure function of (seed, tile).
 *  - Target = the stand model's stems/ha (core/stand standAt: post-fire self-thinning, ~650-900/ha old growth) capped at
 *    STEM_CAP. Real NW Ontario references: jack pine 1164-1789/ha at 47-53 yr, black spruce 2500-3400/ha at 36-38 yr near
 *    Beardmore (Morris et al. / Silva Fennica 2004, doi:10.14214/sf.128); fire-origin black spruce 1300-2150 trees/ha at
 *    80-120 yr (Rossi et al. 2013, Silva Fennica 47(4), doi:10.14214/sf.973). The cap keeps young dense stands affordable;
 *    only stems >= ~8 cm dbh read as crowns from 60 m+ anyway.
 *  - Pattern: Thomas cluster process (core/flora/site thomas, Thomas 1949), sigma 2.5 m / ~4 stems per cluster: boreal
 *    black spruce stays aggregated at 1-8 m 80-120 yr after fire (Rossi 2013, Ripley's L); jack pine near random, clumped
 *    above ~3.6 m in mixed stands (Bouchard / Ann For Sci 2003, doi:10.1051/forest:2003053).
 */
import { CHUNK_SIZE, WORLD_SEED } from '../world';
import { thomas, type Cluster } from './site';

/** Mirror of core/population's tree-entity density (35 generator candidates per 40 m chunk x .6 spruce share x the stand
 *  multiplier clamp(stems / 1500, .45, 2.2) x the governor tree factor). Kept in step by tests/fartrees.test.ts. */
export const ENTITY_TREES = { candidates: 35, share: .6, stemRef: 1500, min: .45, max: 2.2 };
export function drawnTreesPerHa(stems: number | undefined, density = 1) {
  const e = ENTITY_TREES, m = stems === undefined ? 1 : Math.min(e.max, Math.max(e.min, stems / e.stemRef));
  return e.candidates * e.share * m * density * 1e4 / (CHUNK_SIZE * CHUNK_SIZE);
}
/** stemCap: stems/ha target ceiling; fill: share of the gap drawn; tile: placement tile (m); cluster: Thomas offspring. [game calibration] */
export const FAR_TREES = { stemCap: 1300, fill: .6, tile: 32, mu: 4, sigma: 2.5, maxInstances: 6000, sliceMs: 2 };
/** Look-only trees/ha added at a stand: toward min(stems, cap) x density, minus what the entities already draw. Pure. */
export function fillPerHa(stems: number, density = 1) {
  return Math.max(0, Math.min(stems, FAR_TREES.stemCap) * density - drawnTreesPerHa(stems, density)) * FAR_TREES.fill;
}
/** Highest fill intensity (trees/m²) any stand reaches at density 1: the Thomas process' unthinned intensity. */
const LAMBDA_MAX = FAR_TREES.stemCap * FAR_TREES.fill / 1e4;
/**
 * Filler trees of one tile (tx, tz) at the governor tree factor `density`. `stems(x, z)` = stand stems/ha, `dry(x, z)` = 1 on
 * land that carries trees, 0 in water. thomas() thins parents AND offspring by the suitability, so the intensity is
 * kappa·mu·suit²: suit = sqrt(fill / LAMBDA_MAX) hits the target density on smooth stands.
 */
export function farTreesInTile(tx: number, tz: number, density: number, stems: (x: number, z: number) => number, dry: (x: number, z: number) => number, seed = WORLD_SEED) {
  if (density <= 0) return [];
  const c: Cluster = { kappa: LAMBDA_MAX / FAR_TREES.mu, mu: FAR_TREES.mu, sigma: FAR_TREES.sigma };
  const suit = (x: number, z: number) => dry(x, z) * Math.sqrt(Math.min(1, fillPerHa(stems(x, z), density) / 1e4 / LAMBDA_MAX));
  return thomas('fartree', tx, tz, FAR_TREES.tile, c, suit, seed);
}
