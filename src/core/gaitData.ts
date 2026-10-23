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
  // Gallop (run-gallop retune, Grok Bot): Heglund & Taylor 1988 Table 4, their 25 kg dog galloping 4.17-8.25 m/s:
  // f = 2.27 + 0.050 v Hz, scaled to a 40 kg wolf by their gallop mass exponent (Table 3: M^-0.156, x0.929):
  // f = 2.11 + 0.046 v. Frequency is nearly flat ("about 10 % for a doubling of speed"), so a faster gallop is a longer
  // stride, not quicker legs. Cross-checks for 40 kg: Table 3 preferred gallop 4.44 M^-0.156 = 2.50 Hz and maximum
  // sustained gallop 4.70 M^-0.162 = 2.59 Hz; trot-gallop transition 4.19 M^-0.150 = 2.41 Hz at 3.42 m/s (the
  // dog line there gives 2.27). Bryce & Williams 2017's >20 kg Northern breeds: 2.61 Hz at 4.96 m/s (lighter dogs).
  [3.42, 2.27], // trot-gallop transition on the 40 kg dog gallop line (Table 3 allometry: 2.41)
  [5.0, 2.34],  // gallop, 40 kg dog line
  [6.0, 2.39],  // game run key: cruising gallop, stride 2.51 m
  [8.0, 2.48],  // stride 3.2 m
  [10.5, 2.60], // game sprint (dog line continued past 8.25 m/s): stride 4.0 m
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
 * 0.30 at the transition falling to 0.17 at a sprint, so that at 9.2 m/s (duty 0.20, 2.54 Hz) contact is 80 ms and the stance
 * sweep 0.74 m: Walter & Carrier 2007 measured 71-75 ms and ~0.67 m in lighter dogs (duty ~0.21); a heavier wolf with a
 * lower cadence keeps a little longer contact. */
export const GALLOP_DUTY = { transition: .3, sprint: .17 };
export function dutyFactor(gait: CanidGait, froude: number) {
  if (gait === 'walk') return .65;
  if (gait === 'trot') return .45;
  return Math.max(GALLOP_DUTY.sprint, Math.min(GALLOP_DUTY.transition, GALLOP_DUTY.transition - (GALLOP_DUTY.transition - GALLOP_DUTY.sprint) * (froude - FROUDE.trotGallopUp) / (FR_SPRINT - FROUDE.trotGallopUp)));
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
export function suspensions(offsets: readonly number[], duty: number | readonly number[]): Suspension[] {
  const d = (i: number) => typeof duty === 'number' ? duty : duty[i]; // one duty, or one per leg (LF, LH, RF, RH: e.g. lagomorph fore < hind)
  const touch = offsets.map(o => frac(1 - o)), down = (t: number) => offsets.some((o, i) => frac(t + o) < d(i)), out: Suspension[] = [];
  offsets.forEach((o, i) => {
    const t = frac(1 - o + d(i)); if (down(t + 1e-9) || out.some(w => Math.abs(w.from - t) < 1e-9)) return; // a foot is still down, or a pair lifted together
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
/*
 * Reach targets (T-0003 "wolf reach" contract, grok-gait). The data stride (above) needs a stance sweep of duty × stride
 * (0.55-0.72 m) that the rig's legs alone cannot cover (today's gaitFor chord: 0.39 m at a walk or trot, 0.25 m in a gallop).
 * The difference comes from the girdles: the shoulder blades rotate and glide on the thorax, and the pelvis rotates with
 * the lumbar spine (Hildebrand 1959, J. Mammal. 40:481, doi:10.2307/1376265: flexing and extending the back swings the limbs
 * further and lengthens the stride; the scapula rotates about 20° on the spine in both the cheetah and the horse, and the
 * pelvis-to-scapula angle changes about 60° in the galloping horse and 130° in the cheetah; in both, spine motion is
 * greatest at the pelvis). The back is flexed in the gathered suspension and extended in the extended one (Walter & Carrier
 * 2007; Bertram & Gutmann 2009). At a walk or trot the hind legs are half a stride apart, so a shared pelvis rotation
 * cancels and the lumbar spine barely moves (measured 3-8° in walking and trotting dogs: Vet. Sci. 2020, 7:26,
 * doi:10.3390/vetsci7010026, Table 3).
 *
 * Phase convention: `phase` is the canidPlan stride phase in [0, 1) (brain.phase); leg i (LF 0, LH 1, RF 2, RH 3) is in
 * stance while frac(phase + offsets[i]) < duty, with stance progress s = frac(phase + offsets[i]) / duty going 0 at
 * touchdown to 1 at liftoff. Body frame: z in metres, +z is back (as footTarget in core/animalBehavior); angles in radians.
 */
export interface ReachBody {
  /** Stance chord (m) the rig's limb can sweep by IK alone, per gait (input from the rig; today's gaitFor reach). */
  legChord: Readonly<Record<CanidGait, number>>;
  /** Shoulder-to-hip distance along the back (m). */ trunk: number;
  /** Scapula pivot (top of the shoulder blade) to the ground (m): converts a fore girdle shift to a scapula angle. */ foreLever: number;
  /** Hip joint to the ground (m): converts a hind girdle shift to a pelvis angle. */ hindLever: number;
  /** Largest scapula swing from rest (rad), about 20° (Hildebrand 1959); anything beyond is a shoulder glide in metres. */ scapulaMax: number;
}
/** The game wolf today: legChord from gaitFor's reach (WOLF_LEGS), trunk from wolfBody LEG_XZ × WOLF_SCALE (2 × 0.27 m),
 * fore lever = shoulder height 0.55 + shoulder blade 0.17 m, hind lever = hip height 0.56 m. */
export const REF_BODY: ReachBody = { legChord: { walk: .39, trot: .39, gallop: .25 }, trunk: .54, foreLever: .72, hindLever: .56, scapulaMax: .35 };

/**
 * Run-gallop retune (Grok Bot): how far the legs themselves swing in a gallop. Biancardi & Minetti 2012, JEB 215:4144,
 * doi:10.1242/jeb.073031: the maximum excursion of the hip-to-toe line in high-speed gallops is 65.7 +- 7.7 deg (transverse)
 * and 91.1 +- 29.7 deg (rotary), rising as Fr^0.46. The game wolf's old 0.39 m stance chord swung that line only ~38 deg, so
 * the girdles (hidden inside the body) took most of the stride and the legs pattered in a small arc. The stance takes
 * GALLOP_STANCE_EXCURSION (52 deg, the lower end of the measured range: the swing overshoot of footTarget, gait.overshoot,
 * carries the total to ~66 deg); the girdles and spine supply the rest of duty x stride.
 */
/**
 * Swing follow-through per gait (footTarget's Gait.follow). A real paw cannot stop dead at liftoff or touchdown: it leaves
 * the ground moving back relative to the body at running speed and, in fast gaits, swings back toward the ground just
 * before touchdown (swing-leg retraction: Seyfarth, Geyer & Herr 2003, JEB 206:2547, doi:10.1242/jeb.00463; seen in
 * galloping dogs and horses). Gallop keeps half the stance velocity through both ends; walk and trot keep their swing.
 */
export const SWING_FOLLOW: Readonly<Record<CanidGait, number>> = { walk: 0, trot: 0, gallop: .5 };
export const swingFollow = (gait: CanidGait) => SWING_FOLLOW[gait];
export const GALLOP_STANCE_EXCURSION = 52 * Math.PI / 180;
/** Stance chord (m) of a leg whose top joint is `lever` above the ground swinging GALLOP_STANCE_EXCURSION. */
export const gallopLegChord = (lever: number, excursion = GALLOP_STANCE_EXCURSION) => 2 * lever * Math.tan(excursion / 2);
export interface ReachTargets {
  /** duty × stride (m): how far each foot sweeps back relative to the body while it is down. */ sweep: number;
  /** max(0, sweep − legChord) (m): the share the girdles must supply. */ deficit: number;
  /** Per leg (LF, LH, RF, RH): fore-aft shift (m, +back) of the leg's top pivot that keeps the paw within ±legChord/2 of it.
   * In stance it runs linearly from −deficit/2 at touchdown to +deficit/2 at liftoff; in swing it returns smoothly. */
  girdle: number[];
  /** Per fore leg [LF, RF]: scapula rotation from rest (rad, + swings the paw forward, the sign of solveLeg's hip), capped at scapulaMax. */
  scapula: [number, number];
  /** Per fore leg [LF, RF]: what the capped scapula leaves over, as a shoulder glide (m, +back). */
  glide: [number, number];
  /** Lumbar flexion (rad, + = flexed, hips swung forward): the pelvis rotation that carries both hind pivots by their mean shift. */
  spineFlex: number;
  /** Per hind leg [LH, RH]: what the shared pelvis cannot give that leg (m, +back); the limb (leg chord) has to absorb it. */
  hindResidual: [number, number];
  /** Body pitch (rad, + = front up, the sign of posture.bodyPitch): the slope between the girdles from each pair's stance vault. */
  pitch: number;
}
const smoothstep = (s: number) => s * s * (3 - 2 * s);
/** The girdle shift (m, +back) of one leg at stance-cycle position p = frac(phase + offset). */
const girdleShift = (p: number, duty: number, deficit: number) =>
  p < duty ? deficit * (p / duty - .5) : deficit * (.5 - smoothstep((p - duty) / (1 - duty)));
/** Girdle height drop (m) of one stance leg pivoting over its paw: lever − √(lever² − x²), x = paw relative to the pivot. */
const vaultDrop = (lever: number, x: number) => lever - Math.sqrt(Math.max(0, lever * lever - x * x));
/** All reach and pitch targets at one stride phase for a canidPlan. Pure. */
export function reachTargets(plan: CanidPlan, phase: number, body: ReachBody = REF_BODY): ReachTargets {
  const { duty, offsets } = plan, sweep = duty * plan.stride, chord = body.legChord[plan.gait], deficit = Math.max(0, sweep - chord);
  const at = offsets.map(o => frac(phase + o)), girdle = at.map(p => girdleShift(p, duty, deficit));
  const fore = (i: number) => { const want = -girdle[i] / body.foreLever, rot = Math.max(-body.scapulaMax, Math.min(body.scapulaMax, want));
    return [rot, girdle[i] + rot * body.foreLever] as const; };
  const [lf, rf] = [fore(0), fore(2)], mean = (girdle[1] + girdle[3]) / 2;
  // Pitch: a pair in stance holds its girdle at the vault height of its planted paws; a pair in swing does not drop.
  const drop = (legs: number[], lever: number) => { const d = legs.filter(i => at[i] < duty).map(i => vaultDrop(lever, sweep * (at[i] / duty - .5) - girdle[i])); return d.length ? Math.max(...d) : 0; };
  const pitch = Math.atan2(drop([1, 3], body.hindLever) - drop([0, 2], body.foreLever), body.trunk);
  return { sweep, deficit, girdle, scapula: [lf[0], rf[0]], glide: [lf[1], rf[1]], spineFlex: -mean / body.hindLever,
    hindResidual: [girdle[1] - mean, girdle[3] - mean], pitch };
}
export interface ReachRange { sweep: number; deficit: number; spineFlex: [number, number]; scapula: [number, number]; glide: [number, number];
  hindResidual: number; pitch: [number, number]; flexAt: number; extendAt: number }
/** Min/max of the targets over one stride (`n` samples), and the phases of peak flexion and extension. Pure. */
export function reachRange(plan: CanidPlan, body: ReachBody = REF_BODY, n = 400): ReachRange {
  const r: ReachRange = { sweep: 0, deficit: 0, spineFlex: [Infinity, -Infinity], scapula: [Infinity, -Infinity], glide: [Infinity, -Infinity],
    hindResidual: 0, pitch: [Infinity, -Infinity], flexAt: 0, extendAt: 0 };
  const grow = (m: [number, number], v: number) => { m[0] = Math.min(m[0], v); m[1] = Math.max(m[1], v); };
  for (let k = 0; k < n; k++) {
    const t = reachTargets(plan, k / n, body); r.sweep = t.sweep; r.deficit = t.deficit;
    if (t.spineFlex > r.spineFlex[1]) r.flexAt = k / n; if (t.spineFlex < r.spineFlex[0]) r.extendAt = k / n;
    grow(r.spineFlex, t.spineFlex); t.scapula.forEach(v => grow(r.scapula, v)); t.glide.forEach(v => grow(r.glide, v)); grow(r.pitch, t.pitch);
    r.hindResidual = Math.max(r.hindResidual, ...t.hindResidual.map(Math.abs));
  }
  return r;
}
