/**
 * Asymmetric bounding gaits (half-bound / bound) for the shared agent pipeline's animals (Grok Bot, T-0009). Pure: no three.js.
 * Footfall timing per stride phase (0..1), duty factor and stride frequency from species data; the body's airborne arcs are
 * drawn by the bounding controller (animals/locomotion/bounding.ts: planted feet, gaitData suspensionRise for the airborne arcs).
 * Leg order everywhere: [left fore, right fore, left hind, right hind].
 */

export interface BoundGait {
  /** stride phase (0..1) of each foot's touchdown, [LF, RF, LH, RH] */ touchdown: readonly [number, number, number, number];
  /** HIND duty factor bounds: [slow ceiling, fast floor]. Without `sweep`: the value at <= transition speed and at top speed
   *  (linear in between). With `sweep`: the range the sweep-derived duty is clamped to. */ duty: readonly [number, number];
  /** hind stance length (m) the foot sweeps at speed: duty = sweep / stride, clamped to `duty` (a stance length set by the leg,
   *  not by speed: dynamic similarity, Alexander & Jayes 1983) */ sweep?: number;
  /** floor of the fore duty (fast-moving mammals' fore contact approaches 16 % of the cycle: Hildebrand 1977) */ foreMin?: number;
  /** fore contact as a share of hind contact at the transition and at top speed (linear between; default 1 = same as hind) */
  foreShare?: readonly [number, number];
  /** stride frequency: Hz at the transition speed and at top speed (linear between, through `points` [speed, Hz] when given);
   *  below the transition f = fT x (v / vT)^slowExp */
  cadence: { transitionSpeed: number; transitionHz: number; topSpeed: number; topHz: number; slowExp: number; points?: readonly (readonly [number, number])[] };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
export function boundCadence(g: BoundGait, speed: number) {
  const c = g.cadence, v = Math.max(.02, Math.abs(speed));
  if (v <= c.transitionSpeed) return c.transitionHz * (v / c.transitionSpeed) ** c.slowExp;
  const knots: (readonly [number, number])[] = [[c.transitionSpeed, c.transitionHz], ...(c.points ?? []), [c.topSpeed, c.topHz]];
  for (let k = 1; k < knots.length; k++) if (v <= knots[k][0] || k === knots.length - 1) { const [a, fa] = knots[k - 1], [b, fb] = knots[k]; return lerp(fa, fb, (v - a) / (b - a)); }
  return c.topHz;
}
export const boundStride = (g: BoundGait, speed: number) => Math.abs(speed) / boundCadence(g, speed);
/** Hind duty factor at `speed`: sweep / stride clamped to [duty[1], duty[0]] when the gait names a sweep, else linear in speed. */
export function boundDuty(g: BoundGait, speed: number) {
  const c = g.cadence;
  if (g.sweep !== undefined) { const st = boundStride(g, speed); return st > 0 ? Math.min(g.duty[0], Math.max(g.duty[1], g.sweep / st)) : g.duty[0]; }
  return lerp(g.duty[0], g.duty[1], (Math.abs(speed) - c.transitionSpeed) / (c.topSpeed - c.transitionSpeed));
}
/** Fore duty factor at `speed`: the hind duty x the fore share (Hildebrand 1977: Lepus fore contacts <= 70 % of hind at speed). */
export function boundForeDuty(g: BoundGait, speed: number) {
  const c = g.cadence, s = g.foreShare ?? [1, 1];
  const h = boundDuty(g, speed);
  return Math.min(h, Math.max(g.foreMin ?? 0, h * lerp(s[0], s[1], (Math.abs(speed) - c.transitionSpeed) / (c.topSpeed - c.transitionSpeed))));
}
/** Duty per leg in BoundGait order [LF, RF, LH, RH]. */
export const boundDuties = (g: BoundGait, speed: number) => { const h = boundDuty(g, speed), f = boundForeDuty(g, speed); return [f, f, h, h] as const; };
const wrap = (x: number) => ((x % 1) + 1) % 1;
/** Foot `leg` at stride `phase`: in stance (u = 0 at touchdown .. 1 at lift-off) or in swing (u = 0 at lift-off .. 1 at the next touchdown). */
export function footState(g: BoundGait, phase: number, leg: number, dutyOrDuties: number | readonly number[]) {
  const s = wrap(phase - g.touchdown[leg]), duty = typeof dutyOrDuties === 'number' ? dutyOrDuties : dutyOrDuties[leg];
  return s < duty ? { stance: true, u: s / duty } : { stance: false, u: (s - duty) / (1 - duty) };
}
