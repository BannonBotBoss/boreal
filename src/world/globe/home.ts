/**
 * The home region's surface for the globe (Grok Bot): one sampler shared by the main thread and the tile workers.
 * Staged terrain: core/stages/surfaceAt (rivers/soils owner; DOM-free, worker-safe; its height is exactly core/world
 * heightAt on the staged path, tested), which also gives the lake/river water surface. Layered terrain: heightAt.
 */
import { surfaceAt } from '../../core/stages/surfaceAt';
import { heightAt } from '../../core/world';
import { planetFor, type LocalHeight } from './planet';

export function homeSampler(staged: boolean, stagesSeed: number): LocalHeight {
  if (!staged) return heightAt;
  return (x, z) => { const s = surfaceAt(x, z, stagesSeed); return { height: s.height, water: s.lake?.surface ?? s.river?.surface ?? null, soil: s.soil, wet: s.wetness }; };
}
/** The planet the globe uses for these settings (cached per seed + terrain mode). */
export const globePlanet = (seed: number, staged: boolean, stagesSeed: number) =>
  planetFor(seed, homeSampler(staged, stagesSeed), staged ? `staged:${stagesSeed}` : 'layered');
/** Build the expensive per-seed grids now (planet hypsometry, staged stage grids: ~0.25-1 s), not on the first home tile. */
export function warmHome(seed: number, staged: boolean, stagesSeed: number) {
  const t0 = performance.now(); const p = globePlanet(seed, staged, stagesSeed); p.sampleSurface(p.home);
  if (staged) surfaceAt(0, 0, stagesSeed); else heightAt(0, 0);
  return performance.now() - t0;
}
