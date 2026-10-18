/**
 * The home region's surface for the globe (Grok Bot): one sampler shared by the main thread and the tile workers.
 * Staged terrain: core/stages/surfaceAt (rivers/soils owner; DOM-free, worker-safe; its height is exactly core/world
 * heightAt on the staged path, tested), which also gives the lake/river water surface. Layered terrain: heightAt.
 */
import { surfaceAt } from '../../core/stages/surfaceAt';
import { soilGrid, SOIL_KINDS, SOIL_PROPS } from '../../core/stages/soils';
import { heightAt } from '../../core/world';
import { planetFor, type LocalHeight, type LocalSoil } from './planet';

export function homeSampler(staged: boolean, stagesSeed: number): LocalHeight {
  if (!staged) return heightAt;
  const f: LocalHeight = (x, z) => { const s = surfaceAt(x, z, stagesSeed); return { height: s.height, water: s.lake?.surface ?? s.river?.surface ?? null, soil: s.soil, wet: s.wetness }; };
  f.soilW = soilFilter(stagesSeed); return f;
}
/** Tent-filtered stage-3 soil classes over the footprint (radius max(cell, fp), at most ~5x5 grid nodes): class fractions
 *  and wetness (same TWI nudge as soils.soilAt), read straight from the soil grid. */
function soilFilter(seed: number): LocalSoil {
  const ROCK = SOIL_KINDS.indexOf('bedrock'), PEAT = SOIL_KINDS.indexOf('peat'), SAND = SOIL_KINDS.indexOf('sand');
  return (x, z, fp, o) => {
    const S = soilGrid(seed), n = S.n, c = S.cell, r = Math.max(c, fp), k = Math.max(1, Math.ceil(r / c / 2));
    let W = 0, a = 0, b = 0, s = 0, wet = 0;
    for (let j = Math.ceil((z - r) / c); j <= Math.floor((z + r) / c); j += k) {
      const wz = 1 - Math.abs(j * c - z) / r; if (wz <= 0) continue; const row = (((j % n) + n) % n) * n;
      for (let i = Math.ceil((x - r) / c); i <= Math.floor((x + r) / c); i += k) {
        const w = wz * (1 - Math.abs(i * c - x) / r); if (w <= 0) continue;
        const ci = row + (((i % n) + n) % n), kind = S.kind[ci];
        if (kind === ROCK) a += w; else if (kind === PEAT) b += w; else if (kind === SAND) s += w;
        wet += w * Math.min(1, Math.max(0, SOIL_PROPS[SOIL_KINDS[kind]].wet + (S.twi[ci] - 7) * .04)); W += w;
      }
    }
    if (W > 0) { o[0] = a / W; o[1] = b / W; o[2] = s / W; o[3] = wet / W; } else { o[0] = o[1] = o[2] = 0; o[3] = -1; }
  };
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
