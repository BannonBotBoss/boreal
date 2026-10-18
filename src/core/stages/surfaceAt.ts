/**
 * One cheap per-point lookup over the staged generator, for consumers that are not the game scene (Globe Builder tile
 * colouring in src/world/globe/, workers, tools). DOM-free and Web-Worker-safe: it imports only core/stages, core/surface,
 * core/tuning and proc/* (no THREE, no window/document). The first call for a seed builds the stage grids (~0.5-1 s for
 * 256x256, cached per seed in the worker that calls it); every later call is O(1) (a few bilinear samples + one nearby
 * river-segment scan).
 *
 * Height is exactly what core/world heightAt returns on the staged path (stage-1 grid + surface depressions + river carve),
 * without needing STAGES.on, so a globe tile matches the walkable terrain for the same seed.
 */
import { STAGES, elevationGrid, lakeAt, sampleGrid, toWorld } from './elevation';
import { carve, riverAt } from './rivers';
import { soilAt, type SoilKind } from './soils';
import { surfaceDetail } from '../surface';
import { LEVEL } from '../tuning';

export type SurfacePoint = {
  /** Ground height in game metres (river beds carved; lake/sea floors included, NOT the water surface). */
  height: number;
  /** Water surface (m) when the point is in a stage-2b lake/pond or below base water, else null. */
  lake: { surface: number; areaHa: number; kind: 'pond' | 'lake' | 'open' } | null;
  /** River channel at the point (bed or inner bank), else null. order = Strahler. */
  river: { surface: number; order: number; widthM: number } | null;
  /** Stage-3 material ('water' where lake/river/open water covers the ground). */
  soil: SoilKind;
  /** 0 dry ... 1 saturated (soil class nudged by TWI); 1 on water. */
  wetness: number;
};

/** Per-point staged surface. seed defaults to the game's STAGES.seed. x/z are world metres (the grid wraps, toroidal). */
export function surfaceAt(x: number, z: number, seed = STAGES.seed): SurfacePoint {
  const g = elevationGrid(seed), rv = riverAt(seed, x, z);
  const h0 = toWorld(g, sampleGrid(g, x, z)) + surfaceDetail(x, z) * .5, height = rv ? carve(h0, rv) : h0;
  const lk = lakeAt(seed, x, z);
  const lake: SurfacePoint['lake'] = lk ? { surface: lk.surface, areaHa: lk.areaHa, kind: lk.kind }
    : height < LEVEL.waterSurface ? { surface: LEVEL.waterSurface, areaHa: Infinity, kind: 'open' } : null;
  const river = rv && rv.d < rv.half ? { surface: rv.surface, order: rv.order, widthM: rv.half * 2 } : null;
  const so = soilAt(seed, x, z), wet = !!lake || !!river;
  return { height, lake, river, soil: wet ? 'water' : so.kind, wetness: wet ? 1 : so.wet };
}
/** Nearest dry, walkable start to (x, z) on the staged terrain: a ring search in 15 m steps out to `maxR` metres for a
 *  point with no lake/river and ground at least `margin` m above the water plane. Returns (x, z) unchanged if already dry
 *  (or nothing dry was found). Used for the default player start, which is a fixed point and can fall in a lake. */
export function dryStart(x: number, z: number, seed = STAGES.seed, maxR = 900, margin = .6): [number, number] {
  const dry = (px: number, pz: number) => { const p = surfaceAt(px, pz, seed); return !p.lake && !p.river && p.height > LEVEL.waterSurface + margin; };
  if (dry(x, z)) return [x, z];
  for (let r = 15; r <= maxR; r += 15) { const k = Math.max(8, Math.round(2 * Math.PI * r / 15));
    for (let i = 0; i < k; i++) { const a = i / k * 2 * Math.PI, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (dry(px, pz) && dry(px + 6, pz) && dry(px - 6, pz) && dry(px, pz + 6) && dry(px, pz - 6)) return [px, pz]; } }
  return [x, z];
}
