/**
 * Tree density toward real Kenora-area boreal stands (Grok Bot). The tree ENTITIES (core/world + core/population) stay at the
 * generator's ~60-290 trees/ha for gameplay, collision and chunk build cost; render/flora/fartrees tops the drawn density up
 * with look-only trees beyond the near ring, placed here as a pure function of (seed, tile).
 *  - Target = the stand model's stems/ha (core/stand standAt: post-fire self-thinning, ~650-900/ha old growth) capped at
 *    FAR_TREES.stemCap (2150, the top of the mature black spruce range). Real NW Ontario references: jack pine 1164-1789/ha at 47-53 yr, black spruce 2500-3400/ha at 36-38 yr near
 *    Beardmore (Morris et al. / Silva Fennica 2004, doi:10.14214/sf.128); fire-origin black spruce 1300-2150 trees/ha at
 *    80-120 yr (Rossi et al. 2013, Silva Fennica 47(4), doi:10.14214/sf.973). The cap keeps young dense stands affordable;
 *    only stems >= ~8 cm dbh read as crowns from 60 m+ anyway.
 *  - Pattern: Thomas cluster process (core/flora/site thomas, Thomas 1949), sigma 2.5 m / ~4 stems per cluster: boreal
 *    black spruce stays aggregated at 1-8 m 80-120 yr after fire (Rossi 2013, Ripley's L); jack pine near random, clumped
 *    above ~3.6 m in mixed stands (Bouchard / Ann For Sci 2003, doi:10.1051/forest:2003053).
 */
import { CHUNK_SIZE, WORLD_SEED } from '../world';
import { ENTITY_TREES, treeMult } from '../population';
import { thomas, type Cluster } from './site';

export { ENTITY_TREES };
/** Tree entities per hectare core/population draws at a stand (its own treeMult: one formula, tests/fartrees checks it). */
export function drawnTreesPerHa(stems: number | undefined, density = 1) {
  return ENTITY_TREES.candidates * ENTITY_TREES.share * treeMult(stems, density) * 1e4 / (CHUNK_SIZE * CHUNK_SIZE);
}
/** stemCap: stems/ha target ceiling; fill: share of the gap drawn; tile: placement tile (m); cluster: Thomas offspring. [game calibration] */
export const FAR_TREES = { stemCap: 2150, fill: .6, tile: 32, mu: 4, sigma: 2.5, maxInstances: 9000, sliceMs: 2,
  /** sightEps: share of level sight lines into the forest that may still reach the sky (top of the real closed lake edges,
   *  T-0032 calibration, refs/forest-edge/edge-gap.mjs); silhouetteW: mean drawn tree width 2-8 m above the base (m, from
   *  the trees' own triangles, refs/forest-edge/sightline/depth.ts). */
  sightEps: .002, silhouetteW: 1.21 };
/** How deep the drawn forest must reach behind any edge so a level line of sight into it ends on a tree with probability
 *  1 - sightEps: Poisson gaps, P(clear over L) = exp(-lambda w L) (Nilson 1971, Agric. Meteorol. 8: 25-38), lambda = the
 *  trees/m² drawn at the stand (entities + fill, full density: lower tiers thin trees, not deepen the ring). Pure. */
export function sightDepth(stems: number) {
  return Math.log(1 / FAR_TREES.sightEps) / ((drawnTreesPerHa(stems) + fillPerHa(stems)) / 1e4 * FAR_TREES.silhouetteW);
}
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
