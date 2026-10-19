/**
 * Canid gait data (T-0002, grok-gait): a pure model of cadence, stride, duty and footfall timing from measured dogs and
 * wolves, for gaitFor (core/animalBehavior) and the locomotion controller to read. No state, no game imports beyond gravity.
 *
 * Sources:
 * - Heglund & Taylor 1988, JEB 138:301, doi:10.1242/jeb.138.1.301: trot-gallop transition at 1.54·M^0.216 m/s with a stride
 *   frequency of 4.19·M^-0.150 Hz (40 kg wolf: 3.42 m/s, 2.41 Hz). Within a trot and within a gallop, frequency rises only
 *   gently with speed, so speed comes mostly from stride length.
 * - Bryce & Williams 2017, JEB 220:312, doi:10.1242/jeb.144188, Table S2, "Northern" (wolf-like) breeds: walk 1.27 m/s,
 *   1.50 Hz; trot 2.70 m/s, 2.10 Hz; gallop 4.96 m/s, 2.61 Hz.
 * - Maes et al. 2008, JEB 211:138, doi:10.1242/jeb.008243 (Malinois): duty factor below 0.5 above 2 m/s; above about
 *   4 m/s stride length is the main driver of speed.
 * - Walter & Carrier 2007, JEB 210:208: rotary gallop at 9.2 m/s, 71-75 ms contact per limb (duty about 0.21).
 * - Hildebrand 1977, Am. Zool. 17:61 (gait diagrams, rotary vs transverse gallop); Biancardi & Minetti 2012, JEB 215:4144
 *   (canids gallop rotary: LH → RH → RF → LF); Bertram & Gutmann 2009, J. R. Soc. Interface 6:549 (gathered flight).
 * - Alexander & Jayes 1983, J. Zool. 201:135: dynamic similarity, so the curves are kept in Froude terms and scale with leg
 *   length (Fr = v²/(g·h), frequency × √(h/g)).
 */
import { gravity } from '../proc/physics';

export type CanidGait = 'walk' | 'trot' | 'gallop';
/** Reference hip height the measurements are mapped to (the game wolf's WOLF_LEGS.hip, m). */
export const REF_HIP = .55;
/** Measured speed (m/s) and stride frequency (Hz) for a ~40 kg canid at REF_HIP (sources above). */
export const CANID_CADENCE: ReadonlyArray<readonly [number, number]> = [
  [1.27, 1.50], // walk, Bryce & Williams 2017
  [2.70, 2.10], // trot, Bryce & Williams 2017
  [3.42, 2.41], // trot-gallop transition, Heglund & Taylor 1988 (M = 40 kg)
  [4.96, 2.61], // gallop, Bryce & Williams 2017
  [6.0, 2.70],  // gallop (plan T-0002, between Bryce & Williams and Walter & Carrier)
  [10.5, 3.00], // sprint gallop (Walter & Carrier 2007 contact times; Heglund & Taylor's gentle in-gait rise)
];
const fr = (v: number, h: number) => v * v / (gravity() * h);
/** The table as (Froude, dimensionless frequency f·√(h/g)), so it scales with leg length. */
const DIMLESS = CANID_CADENCE.map(([v, f]) => [fr(v, REF_HIP), f * Math.sqrt(REF_HIP / gravity())] as const);

/** Stride frequency (Hz) at `speed` for a leg (hip height) of `legLength`: piecewise linear in Froude terms through the data,
 * gentle power law below the walk point, last slope continued above the sprint point. */
export function cadence(speed: number, legLength = REF_HIP) {
  const F = fr(Math.max(.05, Math.abs(speed)), legLength), k = Math.sqrt(gravity() / legLength), d = DIMLESS;
  if (F <= d[0][0]) return d[0][1] * (F / d[0][0]) ** .25 * k;
  for (let i = 1; i < d.length; i++) if (F <= d[i][0]) { const [f0, c0] = d[i - 1], [f1, c1] = d[i]; return (c0 + (c1 - c0) * (F - f0) / (f1 - f0)) * k; }
  const [f0, c0] = d[d.length - 2], [f1, c1] = d[d.length - 1]; return (c1 + (c1 - c0) * (F - f1) / (f1 - f0)) * k;
}
/** Stride length (m) = speed / cadence. */
export const strideLength = (speed: number, legLength = REF_HIP) => Math.abs(speed) / cadence(speed, legLength);

/** Froude thresholds. Without a previous gait: today's gaitFor midpoints (walk < 0.5, gallop ≥ 2.5). With one: hysteresis,
 * walk ↔ trot at 0.6 up / 0.45 down, trot ↔ gallop at 2.5 up / 2.1 down (T-0002 plan; transition near Heglund & Taylor's 3.42 m/s). */
export const FROUDE = { walkTrot: .5, trotGallop: 2.5, walkTrotUp: .6, walkTrotDown: .45, trotGallopUp: 2.5, trotGallopDown: 2.1 };
export function selectGait(froude: number, prev?: CanidGait): CanidGait {
  if (!prev) return froude < FROUDE.walkTrot ? 'walk' : froude < FROUDE.trotGallop ? 'trot' : 'gallop';
  const up = (g: CanidGait) => g === 'walk' ? froude >= FROUDE.walkTrotUp : g === 'trot' ? froude >= FROUDE.trotGallopUp : false;
  const down = (g: CanidGait) => g === 'gallop' ? froude < FROUDE.trotGallopDown : g === 'trot' ? froude < FROUDE.walkTrotDown : false;
  let g = prev; // at most two steps (walk ? gallop on a jump in speed)
  for (let k = 0; k < 2; k++) g = up(g) ? (g === 'walk' ? 'trot' : 'gallop') : down(g) ? (g === 'gallop' ? 'trot' : 'walk') : g;
  return g;
}

/** Sprint Froude for the gallop duty ramp (10.5 m/s at REF_HIP). */
const FR_SPRINT = fr(10.5, REF_HIP);
/** Duty factor (share of a stride each foot is down): walk 0.65, trot 0.45 (Maes et al. 2008: < 0.5 above 2 m/s), gallop
 * 0.30 at the transition falling to 0.20 at a sprint (Walter & Carrier 2007: ~0.21 at 9.2 m/s). */
export function dutyFactor(gait: CanidGait, froude: number) {
  if (gait === 'walk') return .65;
  if (gait === 'trot') return .45;
  return Math.max(.2, Math.min(.3, .3 - .1 * (froude - FROUDE.trotGallopUp) / (FR_SPRINT - FROUDE.trotGallopUp)));
}
/** Stance sweep per foot (m) = duty × stride: about 0.67 m at 9.2 m/s (Walter & Carrier 2007). */
export function stanceReach(speed: number, legLength = REF_HIP, gait?: CanidGait) {
  const F = fr(Math.abs(speed), legLength); return dutyFactor(gait ?? selectGait(F), F) * strideLength(speed, legLength);
}

/** Phase offsets in leg order LF, LH, RF, RH (an offset leads the cycle; a foot lands at phase 1 − offset). */
export const OFFSETS = {
  walk: [.25, 0, .75, .5],          // lateral-sequence walk
  trot: [0, .5, .5, 0],             // diagonal pairs
  /** rotary gallop, left lead: LH 0, RH .1, RF .4, LF .55 (Hildebrand 1977; Biancardi & Minetti 2012) */
  gallopLeft: [.45, 0, .6, .9],
  /** mirror, right lead: RH 0, LH .1, LF .4, RF .55 */
  gallopRight: [.6, .9, .45, 0],
} as const;
export const offsetsFor = (gait: CanidGait, lead: 'left' | 'right' = 'left'): readonly number[] =>
  gait === 'gallop' ? (lead === 'left' ? OFFSETS.gallopLeft : OFFSETS.gallopRight) : OFFSETS[gait];
const frac = (v: number) => v - Math.floor(v);
/** Footfall order (leg indices LF 0, LH 1, RF 2, RH 3) by touchdown phase, starting from the first touchdown after phase 0. */
export const footfallOrder = (offsets: readonly number[]) => offsets.map((o, i) => [frac(1 - o), i] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]);

export interface Suspension { from: number; to: number; kind: 'gathered' | 'extended' }
/** Windows of the stride (phase fractions) when all four feet are off the ground. Gathered = it starts when a fore foot lifts
 * off (legs tucked under, back flexed); extended = it starts when a hind foot lifts off (legs stretched, back extended). */
export function suspensions(offsets: readonly number[], duty: number): Suspension[] {
  const touch = offsets.map(o => frac(1 - o)), down = (t: number) => offsets.some(o => frac(t + o) < duty), out: Suspension[] = [];
  offsets.forEach((o, i) => {
    const t = frac(1 - o + duty); if (down(t + 1e-9) || out.some(w => Math.abs(w.from - t) < 1e-9)) return; // a foot is still down, or a pair lifted together
    out.push({ from: t, to: t + Math.min(...touch.map(d => frac(d - t) || 1)), kind: i % 2 === 0 ? 'gathered' : 'extended' }); // `to` may pass 1
  });
  return out.sort((x, y) => x.from - y.from);
}
/** Ballistic rise of the body (m) over a suspension lasting `fraction` of a stride at `hz`: g·t²/8. */
export const suspensionRise = (fraction: number, hz: number) => gravity() * (fraction / hz) ** 2 / 8;

export interface CanidPlan { gait: CanidGait; froude: number; hz: number; stride: number; duty: number; offsets: readonly number[]; suspensions: Suspension[] }
/** Everything for one speed: gait (with hysteresis when `prev` is given), cadence, stride, duty, offsets and suspensions. */
export function canidPlan(speed: number, legLength = REF_HIP, prev?: CanidGait, lead: 'left' | 'right' = 'left'): CanidPlan {
  const v = Math.abs(speed), F = fr(Math.max(.05, v), legLength), gait = selectGait(F, prev), duty = dutyFactor(gait, F), offsets = offsetsFor(gait, lead);
  return { gait, froude: F, hz: cadence(v, legLength), stride: strideLength(Math.max(.05, v), legLength), duty, offsets, suspensions: suspensions(offsets, duty) };
}