/**
 * Bed steps in steep channels, and the water×rock aeration that whites the lee (T-0030).
 *
 * Reach split at S = 0.02 and S = 0.08 follows the river audit's reading of Montgomery & Buffington 1997
 * (GSA Bull. 109:596): step-pool, then cascade. Clast diameters are the T-0026 Shield sizes (ROCK_SIZES),
 * not a new table. Spacing is the Abrahams, Li & Atkinson 1995 (WRR 31:2593) lower bound (H/L)/S = 1,
 * the case where the steps account for the whole drop.
 *
 * Aeration is one transaction, water|rock. The roughness Froude number is Boes & Hager 2003
 * (J. Hydraul. Eng. 129(9):661), F* = q / sqrt(g sinθ k^3), k = H cosθ, as restated in USBR HL-2005-06.
 * Depth-mean air at inception is Matos 2000a as quoted there (eq. 19): C = 0.163 F*^0.154.
 * The sheet draws the free surface, which Wood 1983 defines as the Y90 = 0.9 contour, and only in the
 * lee of the clast (Kim 2015, Jurnal Teknologi: air entrained behind the trailing edge of the gravel).
 * A reach with no step stays clear, whatever its speed.
 */
import { ROCK_SIZES } from '../rocks';
import { gravity } from '../../proc/physics';
import { TRANSACTIONS } from '../transactions';
import { riverAt, riverGrid, segmentGeom } from './rivers';

/** Montgomery & Buffington 1997 bands as the audit already cuts them: step-pool above 0.02, cascade above 0.08. */
export const REACH = { stepPoolS: .02, cascadeS: .08 };
/** Wood 1983: the free surface of self-aerated flow is the contour where the air concentration is 0.9. */
export const Y90 = .9;
/** Matos 2000a via USBR HL-2005-06 eq. 19. Steep-slope inception averages about 0.2. */
export const MATOS = { a: .163, b: .154 };

export interface ChannelStep {
  x: number; z: number; height: number; spacing: number; slope: number;
  dirX: number; dirZ: number; tier: 1 | 2;
}
export interface AerateIn { q: number; slope: number; k: number; inLee: boolean }

/** Vertical clast size for a steep reach: 0.95 m erratic on step-pool, 1.65 m on cascade (ROCK_SIZES 9 and 10). */
export function stepHeight(slope: number): number {
  return slope > REACH.cascadeS ? ROCK_SIZES[10] : ROCK_SIZES[9];
}
/** L = H/S, so (H/L)/S = 1. Abrahams et al. 1995, lower bound of 1 ≤ (H/L)/S ≤ 2. */
export function stepSpacing(slope: number): number {
  return stepHeight(slope) / slope;
}
export function stepsOnSegment(seg: NonNullable<ReturnType<typeof segmentGeom>>): ChannelStep[] {
  if (!(seg.slope > REACH.stepPoolS)) return [];
  const height = stepHeight(seg.slope), spacing = height / seg.slope, out: ChannelStep[] = [];
  for (let dist = spacing * .5; dist < seg.len; dist += spacing) out.push({
    x: seg.ax + seg.dirX * dist, z: seg.az + seg.dirZ * dist, height, spacing, slope: seg.slope,
    dirX: seg.dirX, dirZ: seg.dirZ, tier: seg.slope > REACH.cascadeS ? 2 : 1,
  });
  return out;
}
/** Steps on drawn segments whose nodes fall in the unwrapped neighbourhood of (x, z). */
export function stepsNear(seed: number, x: number, z: number): ChannelStep[] {
  const s = riverGrid(seed).cell, fi = Math.floor(x / s), fj = Math.floor(z / s), out: ChannelStep[] = [];
  for (let dj = -1; dj <= 2; dj++) for (let di = -1; di <= 2; di++) {
    const seg = segmentGeom(seed, fi + di, fj + dj); if (seg) out.push(...stepsOnSegment(seg));
  }
  return out;
}
/** Steps whose centres lie in [x0, x1) × [z0, z1). One chunk's worth. */
export function stepsInRect(seed: number, x0: number, z0: number, x1: number, z1: number): ChannelStep[] {
  const s = riverGrid(seed).cell, out: ChannelStep[] = [], seen = new Set<string>();
  const i0 = Math.floor(x0 / s) - 1, i1 = Math.floor((x1 - 1e-6) / s) + 1;
  const j0 = Math.floor(z0 / s) - 1, j1 = Math.floor((z1 - 1e-6) / s) + 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const seg = segmentGeom(seed, i, j); if (!seg) continue;
    for (const step of stepsOnSegment(seg)) {
      if (step.x < x0 || step.x >= x1 || step.z < z0 || step.z >= z1) continue;
      const key = `${step.x.toFixed(2)}:${step.z.toFixed(2)}`; if (seen.has(key)) continue;
      seen.add(key); out.push(step);
    }
  }
  return out;
}
/** The step centred on this point, if a channel boulder was placed here. */
export function channelStepAt(seed: number, x: number, z: number): ChannelStep | undefined {
  return stepsNear(seed, x, z).find(step => Math.hypot(step.x - x, step.z - z) < .05);
}

/** Boes & Hager roughness height normal to the bed, k = H cosθ, θ = atan(S). */
export function roughnessK(height: number, slope: number): number {
  return height * Math.cos(Math.atan(slope));
}
/** F* = q / sqrt(g sinθ k^3). g is gravity(), not a literal. */
export function roughnessFroude(q: number, slope: number, k: number): number {
  const sin = Math.sin(Math.atan(slope));
  const denom = Math.sqrt(Math.max(0, gravity() * sin * k ** 3));
  return denom > 0 && q > 0 ? q / denom : 0;
}
/** Depth-mean air concentration at inception. Not the free-surface colour. */
export function inceptionAir(fStar: number): number {
  return fStar > 0 ? MATOS.a * fStar ** MATOS.b : 0;
}

const SRC = 'Boes & Hager 2003, J. Hydraul. Eng. 129(9):661, F* = q/sqrt(g sinθ k^3), k = H cosθ (USBR HL-2005-06). Matos 2000a C = 0.163 F*^0.154 (USBR HL-2005-06 eq. 19). Free surface is Wood 1983 Y90 = 0.9, drawn only in the clast lee (Kim 2015, Jurnal Teknologi).';
TRANSACTIONS.add({
  a: 'water', b: 'rock', verb: 'aerate', name: 'aerate', needsContact: false, source: SRC,
  run(a: AerateIn): number {
    if (!a.inLee) return 0;
    return inceptionAir(roughnessFroude(a.q, a.slope, a.k)) > 0 ? Y90 : 0;
  },
});

/**
 * Physical lee: the clast disk (radius H/2) plus one clast height downstream of the trailing edge.
 * `sample` is half a water-cell diagonal. The sheet has one vertex per cell, so a vertex is aerated
 * when that lee comes within half a cell of it. sample = 0 is the physical lee alone.
 */
export function inLee(x: number, z: number, step: ChannelStep, sample = 0): boolean {
  const dx = x - step.x, dz = z - step.z, along = dx * step.dirX + dz * step.dirZ;
  const cross = Math.abs(-dx * step.dirZ + dz * step.dirX), radius = step.height / 2;
  return along >= -radius - sample && along <= radius + step.height + sample && cross <= radius + sample;
}
/** Free-surface aeration at (x, z): 0, or Y90 when the water×rock transaction fires. Banks and glides stay 0. */
export function surfaceAeration(seed: number, x: number, z: number, sample = 0, hit = riverAt(seed, x, z)): number {
  if (!hit || hit.d > hit.half) return 0;
  const q = hit.speed * hit.depth;
  for (const step of stepsNear(seed, x, z)) {
    if (!inLee(x, z, step, sample)) continue;
    const air = TRANSACTIONS.run('water', 'rock', { q, slope: hit.slope, k: roughnessK(step.height, hit.slope), inLee: true } satisfies AerateIn, 'aerate');
    if (air > 0) return air;
  }
  return 0;
}

/** Share of foam pixels that sit in the lee. No foam scores 1. A uniform white sheet scores the lee's area share. */
export function foamLocality(foam: readonly boolean[], lee: readonly boolean[]): number {
  let n = 0, hit = 0;
  for (let i = 0; i < foam.length; i++) if (foam[i]) { n++; if (lee[i]) hit++; }
  return n === 0 ? 1 : hit / n;
}
/**
 * 1 when the measured pattern speed equals the model. 0 when it misses by the whole model
 * (twice as fast, or stopped). The shader cancels the 1.3 sample scale, so metres = speed × seconds.
 */
export function advectionScore(measured: number, model: number): number {
  if (!(model > 0)) return measured === 0 ? 1 : 0;
  return 1 - Math.abs(measured - model) / model;
}
export const patternMetres = (speed: number, seconds: number) => speed * seconds;
