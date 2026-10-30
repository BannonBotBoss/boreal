/**
 * T-0044 run 15 (grok-gait): fore stance plan - how far the fore chain's root (the scapula pivot, bounding.ts `top`) sinks
 * so a planted fore leg stays off full reach through stance. Pure, allocation-free scalar maths (Rust-portable).
 *
 * Two terms, the larger is used, then a rate limit:
 * 1. reach (the root-offset step of game foot IK, re-implemented, no code copied: Unreal Engine's Leg IK / foot-placement
 *    "pelvis offset" and Final IK's Grounder lower the body root by the amount the farthest planted foot cannot reach, so the
 *    leg is not driven to straight). Here per fore leg: sink the root until |root -> paw| <= k x the chain's straight length.
 * 2. gather (T-0044 run 15 brief, Matthew's research note): while the hind legs swing (the gathered phase) the lumbar spine
 *    flexes into a C and the chest / shoulders drop toward the fore footholds; with the hinds in stance the spine extends.
 *    Timing: lumbar flexion peaks just before hind touchdown, extension at hind lift-off (Schilling & Hackert 2006, JEB
 *    209:3925, already the bounding.ts spine curve); flexed-back half-bound of escaping leporids (Bertram & Gutmann 2009,
 *    J R Soc Interface 6:549, Fig. 6b). The drop amplitude has no lagomorph source: [estimate], a tunable.
 */
export interface StancePlanParams { /** max |root->paw| / chain length */ k: number; /** cap on the sink (m) */ maxDrop: number;
  /** gather drop at the hind-swing peak (m) */ gather: number; /** rise while the hinds are in stance (m, >= 0) */ extend: number;
  /** hind swing progress of the flexion peak (0..1) */ peak: number; /** sink / rise rate limit (m/s) */ rate: number; }

import { softSplit, softDistance } from './softIK';

const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (u: number) => { const s = clamp01(u); return s * s * (3 - 2 * s); };

/** The sink (m, >= 0) the reach term asks for: root at (0,0), paw at (dz, dy) (dy < 0 below), chain straight length R. */
export function reachDrop(dz: number, dy: number, R: number, k: number): number {
  const lim = k * R; if (!(lim > 0)) return 0;
  const az = Math.abs(dz), h = -dy; // vertical root-to-paw distance (positive with the paw below)
  if (Math.hypot(dz, dy) <= lim) return 0;
  if (az >= lim) return Math.max(0, h); // no sink reaches it: as far as the paw's own level
  return Math.max(0, h - Math.sqrt(lim * lim - az * az));
}

/** Gather weight of one hind leg (0..1): a bump over its swing peaking at `peak`; 0 in stance. */
export function gatherWeight(phase: number, duty: number, peak: number): number {
  if (phase < duty || duty >= 1) return 0;
  const s = (phase - duty) / (1 - duty), p = Math.min(.99, Math.max(.01, peak));
  return s <= p ? smooth(s / p) : smooth((1 - s) / (1 - p));
}

/** Stance weight of one hind leg (0..1): sin bump over its stance (extension at mid stance .. lift-off). */
export function stanceWeight(phase: number, duty: number): number { return phase < duty && duty > 0 ? Math.sin(Math.PI * phase / duty) : 0; }

/** The gather term (m, + = sink) from the two hind legs' phases and duty. */
export function gatherDrop(phL: number, phR: number, duty: number, P: StancePlanParams): number {
  const g = (gatherWeight(phL, duty, P.peak) + gatherWeight(phR, duty, P.peak)) / 2, e = (stanceWeight(phL, duty) + stanceWeight(phR, duty)) / 2;
  return P.gather * g - P.extend * e;
}

/** The next sink: the wanted one (max of the two terms, capped) reached from `prev` at <= rate x dt. */
export function stanceDropStep(prev: number, want: number, P: StancePlanParams, dt: number): number {
  const w = Math.min(P.maxDrop, want), step = P.rate * dt;
  return w > prev + step ? prev + step : w < prev - step ? prev - step : w;
}
/** Fix-brief 2b dip (m, >= 0): the soft-IK excess (Nicholas 2006 curve, softIK.ts softSplit / softDistance) of a root-to-paw
 *  distance d on a chain of straight length R with soft ratio `ratio`, capped at maxDip: past the hard length the paw would
 *  reach only the soft distance, so the root sinks by what is left. */
export function softDip(d: number, R: number, ratio: number, maxDip: number): number {
  const { hard, soft } = softSplit(R, ratio); if (d <= hard) return 0;
  return Math.min(maxDip, Math.max(0, d - softDistance(d, hard, soft)));
}