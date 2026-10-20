/**
 * Settling a solid on the earth (grok-globe, T-0005; Matthew 2026-10-19): gravity pulls a fallen trunk down and the earth
 * yields until the earth's push equals the trunk's weight; the trunk ends flat against the ground, pressed in by about a
 * third of its width. Modelled as buoyant equilibrium in yielding ground (Archimedes): the trunk sinks until the earth it
 * displaces weighs as much as the trunk, so the immersed share of its cross-section = trunk density / earth density.
 * No new constants: the trunk density is the log composition (core/materials COMPOSITIONS.log.body, ~512 kg/m3, the same
 * one render/mass weighs logs with); the earth is the soil at the point (core/stages/soils soilAt: kind, wetness, depth to
 * bedrock) with core/ground's bulk densities (MINERAL.bulk 1200-1500 kg/m3, seeded per log; PEAT_BULK 100) and its pores
 * (1 - bulk / quartz 2650, core/materials) filled with water by the site wetness. Till (wet .45) comes out at ~0.36 of the
 * width, clay ~0.34, sand ~0.39, peat ~0.5. Under a lake or river (soil kind 'water') the log lies on the bed, which is taken as
 * saturated glaciolacustrine clay (core/stages/soils' lake-plain material), ~0.32. The earth over bedrock yields only down to the
 * bedrock (bedrock outcrop: 2-10 cm). Pure TypeScript, no three.js.
 */
import { COMPOSITIONS, MATERIALS, density } from './materials';
import { MINERAL, PEAT_BULK } from './ground';
import type { SoilKind } from './stages/soils';

export const TRUNK_DENSITY = density(COMPOSITIONS.log.body); // kg/m3
/** Share of a circle's area below a chord at depth h (h = depth / diameter, 0-1). */
export function segmentShare(h: number) { const t = 2 * Math.acos(1 - 2 * Math.min(1, Math.max(0, h))); return (t - Math.sin(t)) / (2 * Math.PI); }
/** Depth / diameter at which the immersed share of a circle is `share` (bisection, monotonic). */
export function depthForShare(share: number) { let lo = 0, hi = 1; const s = Math.min(1, Math.max(0, share)); for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (segmentShare(m) < s) lo = m; else hi = m; } return (lo + hi) / 2; }
/** Earth density (kg/m3) at a soil point: dry bulk + pore water. `u` (0-1, seeded) picks the mineral bulk within its range. */
export function earthDensity(kind: SoilKind, wet: number, u: number) {
  const bulk = kind === 'water' ? 0 /* plain water: a floating trunk */ : kind === 'peat' ? PEAT_BULK : MINERAL.bulk[0] + (MINERAL.bulk[1] - MINERAL.bulk[0]) * u;
  return bulk + wet * (1 - bulk / MATERIALS.quartz) * MATERIALS.water;
}
export interface Settle { trunkDensity: number; earthDensity: number; soil: SoilKind; /** depth / diameter, perpendicular to the ground */ depth: number; /** true if bedrock stopped it */ onRock: boolean }
/** How far a trunk of `diameter` m sinks into the soil at a point: the force balance above, then the bedrock limit. */
export function settleTrunk(diameter: number, soil: { kind: SoilKind; wet: number; depth: [number, number] }, u: number): Settle {
  const bed = soil.kind === 'water', y = bed ? earthDensity('clay', 1, u) : earthDensity(soil.kind, soil.wet, u), d = depthForShare(TRUNK_DENSITY / Math.max(y, 1));
  const rock = bed ? Infinity : (soil.depth[0] + (soil.depth[1] - soil.depth[0]) * u) / diameter; // yielding layer over bedrock, in diameters
  return { trunkDensity: TRUNK_DENSITY, earthDensity: y, soil: soil.kind, depth: Math.min(d, rock), onRock: rock < d };
}
