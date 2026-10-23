/**
 * Bounding controller (grok-gait, T-0009): half-bound and lagomorph-gallop footfalls on a limb skeleton from bodyPlan.ts.
 * Data-driven: the footfall timing, duty and cadence come in as a core/needs/bound BoundGait (the species data, core/needs/species
 * HARE_GAIT; its pure functions are reused, not copied), the limbs as a Skeleton. Nothing names a species.
 *
 * Sources for the gait shape (numbers stay in the host's BoundGait; see the T-0009 grok-gait handoff for the check):
 * - Half-bound: the hind feet land in near unison, the fore feet staggered (Bertram & Gutmann 2009, J R Soc Interface 6:549,
 *   PMC2696142; Hildebrand 1977, Am Zool 17:85). Slow bounds are stiff-backed, fast ones flexed-back.
 * - Lagomorph gallop: four stages per stride, fore support → gathered suspension (fore limbs swing back, hind forward) →
 *   hind support → extended suspension (Bramble 1989, Am Zool 29:171, doi:10.1093/icb/29.1.171; Lagomorpha Locomotion,
 *   Encycl. Anim. Cogn. Behav. 2021, doi:10.1007/978-3-319-47829-6_1199-1). The hind feet land AHEAD of the fore prints.
 * - Spine: flexion peaks just before hind touchdown, extension at hind lift-off (Schilling & Hackert 2006, JEB 209:3925,
 *   doi:10.1242/jeb.02400). Driven here by core/gaitData reachTargets (the T-0003 girdle model), which peaks there by itself.
 *
 * Frames: limb frame as controller.ts (x right, y up, z back, origin at the limb's ground point); the body origin is the
 * ground point under the hip joints, and the body pitches about the hip joint (Tilt.shift), so a sit-up rocks on the hips.
 * Leg order: LF, LH, RF, RH (the locomotion layer's); BoundGait uses LF, RF, LH, RH and is converted once in rowOffsets.
 */
import { boundCadence, boundDuty, boundForeDuty, type BoundGait } from '../../core/needs/bound';
import { reachTargets, suspensions, type CanidPlan, type ReachBody, type Suspension } from '../../core/gaitData';
import type { LimbDims } from '../../core/animalBehavior';
import { createCpg, stepCpg, phases, type Cpg } from './cpg';
import { footState, forceStep, stepFoot, toWorld, type FootState } from './foot';
import { solveLimb, clampLimb, soleOf, blendLimits, toeTarget, CANID_LIMITS, type JointLimits, type LimbAngles } from './ik';
import { worldToLimb, limbToWorld } from './controller';
import { springTo, spring, type Spring } from './spring';
import type { Tilt } from './balance';
import type { Skeleton } from './bodyPlan';
import type { TerrainFn, Vec3 } from './signals';
import { gravity } from '../../proc/physics';

const frac = (x: number) => x - Math.floor(x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
export const BOUND_LEGS = ['LF', 'LH', 'RF', 'RH'] as const;
const FRONT = (i: number) => i % 2 === 0;

/* ---------------------------------------------------------------- gait rows */
export type BoundRowId = 'half-bound' | 'gallop-lagomorph';
export interface BoundRow { id: BoundRowId; /** touchdown phase [LF, RF, LH, RH] */ touchdown: readonly [number, number, number, number] }
/**
 * The two rows from one BoundGait. 'half-bound' is the host data as given. 'gallop-lagomorph' keeps the fore pair and the
 * hind start but staggers the hinds by the fore lag with the lead on the other side (rotary: Hildebrand 1977) — [estimate]:
 * no source gives the lagomorph hind lag; flagged in the T-0009 handoff.
 */
export function boundRows(g: BoundGait): Record<BoundRowId, BoundRow> {
  const [lf, rf, lh, rh] = g.touchdown, lag = Math.abs(rf - lf), first = Math.min(lh, rh);
  return { 'half-bound': { id: 'half-bound', touchdown: g.touchdown }, 'gallop-lagomorph': { id: 'gallop-lagomorph', touchdown: [lf, rf, first + lag, first] } };
}
/** CPG offsets (LF, LH, RF, RH) of a row: a leg is in stance while frac(stride + offset) < duty, so offset = frac(1 − touchdown). */
export const rowOffsets = (r: BoundRow): number[] => { const [lf, rf, lh, rh] = r.touchdown; return [lf, lh, rf, rh].map(t => frac(1 - t)); };
/** Speeds (m/s) between the rows, with hysteresis. Leporids half-bound at all but the fastest speeds (Simons 1999 in
 * Bertram & Gutmann 2009), and the escape gait of rabbits and hares is the flexed-back half-bound (Bertram & Gutmann 2009);
 * Lepus also gallops (Hildebrand 1977 Table 1). So the gallop row is kept for the top of the range, above the hare's 8.5 m/s
 * flight speed: up 10, down 9.5 m/s [estimate: no measured switch speed found]. ?row= in the lab forces one. */
export const ROW_SWITCH = { up: 10, down: 9.5 };
export const selectRow = (speed: number, prev: BoundRowId = 'half-bound'): BoundRowId =>
  prev === 'half-bound' ? (speed > ROW_SWITCH.up ? 'gallop-lagomorph' : 'half-bound') : (speed < ROW_SWITCH.down ? 'half-bound' : 'gallop-lagomorph');

/* ---------------------------------------------------------------- hind foot angle */
/**
 * The hind foot does not hold one angle through stance: it lands near flat, rolls, and leaves toe-first behind the hip,
 * the ankle staying near its working angle while the proximal and distal segments move together (the pantograph-like
 * tri-segmented mammal limb: Fischer & Blickhan 2006, J Exp Zool 305A:935, doi:10.1002/jez.a.333). Rule: of the foot
 * angles that reach `sole` within the joint clamps, take the one whose ankle angle is nearest `ankle` (the standing one),
 * tie-broken toward `prev` (continuity). Returns psi (rad from vertical, + = hock behind the toes) and whether it reaches.
 * `limits` are the body's joint ranges; when they carry a stance foot range and `pitch` (body pitch, rad, + nose up) is
 * given, only foot angles inside it are tried: the foot-to-ground angle is 90° − (psi + pitch).
 */
export const FOOT_SCAN = { from: -.8, to: 1.55, step: .05 };
export function hindFoot(L: LimbDims, top: { z: number; y: number }, sole: Vec3, ankle: number, prev?: number, limits: JointLimits = CANID_LIMITS, pitch?: number) {
  let best = { psi: L.footAngle ?? 0, cost: Infinity, err: Infinity, ok: false };
  // run 3 fix: a nose-up pitch turns the limb frame's back direction down, so foot-to-ground = 90° − (psi + pitch) (run 2 had − pitch)
  const fr = limits.hind.foot, D = Math.PI / 180, lo = fr && pitch !== undefined ? -pitch + (90 - fr.max) * D : -Infinity, hi = fr && pitch !== undefined ? -pitch + (90 - fr.min) * D : Infinity;
  for (let psi = FOOT_SCAN.from; psi <= FOOT_SCAN.to + 1e-9; psi += FOOT_SCAN.step) {
    if (psi < lo - 1e-9 || psi > hi + 1e-9) continue;
    const LL = { ...L, footAngle: psi }, a = clampLimb(solveLimb(LL, true, sole, 0, { top }), false, limits), s = soleOf(LL, a);
    const err = Math.hypot(s.z - sole.z, s.y - (top.y - Math.hypot(top.y - sole.y, sole.x))), ok = err < 1e-4;
    const cost = (a.wrist - ankle) ** 2 + (prev === undefined ? 0 : .3 * (psi - prev) ** 2);
    if (ok && (!best.ok || cost < best.cost)) best = { psi, cost, err, ok };
    else if (!ok && !best.ok && err < best.err) best = { psi, cost, err, ok };
  }
  return best;
}
/** The standing ankle angle of a skeleton (solveChain's `wrist` at the rest foot). */
export function restAnkle(sk: Skeleton) {
  const H = { ...sk.legs.hind, footAngle: sk.restFootAngle };
  return solveLimb(H, true, { x: 0, y: 0, z: -(H.stance ?? 0) }, 0, { top: { z: 0, y: H.hip } }).wrist;
}

/* ---------------------------------------------------------------- fore limb with a shoulder blade */
/**
 * Fore limb with the blade as a chain segment (bodyPlan.ts BodyPlan.scapula): the blade angle and the manus angle are picked
 * per frame, like hindFoot. Of the (blade, manus) pairs that reach `sole` within the joint clamps, with the blade inside
 * rest ± GIRDLE.scapulaMax (pika: Fischer et al. 2002), take the one whose blade is nearest parallel to the forearm, for the
 * forelimb's "matched motion": the
 * pantograph pairing is scapula and forearm (Schmidt 2008, JEB 211:3775, citing Fischer & Blickhan 2006: "parallel motion of
 * scapula and forearm and femur and tarsometatarsus"), and it is parallel MOTION, not parallel orientation: "throughout most
 * of the support phase, the forearm moves exactly in parallel to the scapula ... only broken at the beginning and end of the
 * support phase", while the angles themselves differ (scapula ~45° → ~90°, forearm 11-36° → 102-121° against the horizontal,
 * Schmidt 2008 Table 4). The rule kept here is v3's nearest-parallel orientation, which gives equal angular steps wherever
 * it holds (mid-stance); a rate-matching cost (change of blade − forearm per frame) was tried in run 4 and flipped the elbow
 * mid-stance, so it was dropped. Tie-broken toward `prev` and toward `psiWant` (the manus fold of a lifting paw). `any`: stop
 * at the first reaching pair (reach scans only ask whether one exists).
 */
/**
 * v8 (T-0009 run 8, grok-gait): foreLimb's continuity weight. `carry` .3 (since run 3) keeps the blade / manus near the previous
 * frame's choice, which stops the scan flipping between solution families frame to frame. On the frame a moving fore paw
 * PLANTS the weight is `plant` 0: carried over from the swing it kept a folded-elbow stance family whose touchdown forearm
 * fell to 7-9 deg below the horizontal at 60-120 Hz (8.5-11.6 m/s; run 8 contact scorer, src/animals/locomotion/contactScore.ts),
 * under the 11-36 deg measured at fore touchdown in small therians (Schmidt 2008 JEB 211:3775 Table 4). From the next frame
 * on, `carry` applies again. Calibration [estimate], not a measurement.
 */
export const FORE_CONT = { carry: .3, plant: 0 };
/** v9: the held manus angle through stance - the planting value, then from stance `holdUntil` turning smoothly to `psiOff` (the
 *  scan's back limit) by lift-off, so the late-stance manus rotation starts in time instead of flipping at the end. */
export function stancePsi(psiLock: number, u: number, k = FORE_LOCK) { const t = Math.max(0, Math.min(1, (u - k.holdUntil) / (1 - k.holdUntil))); return psiLock + (k.psiOff - psiLock) * t * t * (3 - 2 * t); }
/** v9: late in the swing the manus target turns toward the angle the paw planted with last stride (`preFrom` .. touchdown), so
 *  the paw arrives on the stance branch instead of switching at contact. */
export function preSwingPsi(want: number, plant: number | undefined, sp: number, moving: boolean, k = FORE_LOCK) {
  if (plant === undefined || !moving) return want; const t = Math.max(0, Math.min(1, (sp - k.preFrom) / (1 - k.preFrom))); return want + (plant - want) * t * t * (3 - 2 * t); }
/** T-0009 run 9 (grok-gait): fore-limb IK solution lock (branch lock + warm start + hysteresis).
 * Reused approaches (rule 15): warm-starting the IK from the previous frame's solution, a windowed
 * (rate-limited) local solve around it, hysteresis on the branch (only leave it when no exact solution is
 * left in the window), and on release the nearest exact branch (continuity weight `nearest`), not the cheapest.
 * - Plant (swing->stance frame): the branch is chosen fresh (`plant: 0`, FORE_CONT.plant = 0) so the
 *   exact-contact forearm gate (11-36 deg, Schmidt 2008 Table 4) holds; its psi is stored as lockPsi.
 * - Stance: windowed solve around the previous solution; psi window = stanceShare * sweep / t_stance * dt
 *   (sweep 88 deg = Schmidt 2008 TD->LO forearm sweep; stanceShare 1.8 is an estimate), capped at maxStep;
 *   blade window = bladeRate * dt. Both scale with dt, so the lock is frame-rate independent.
 *   psiWant = stancePsi(lockPsi, u): the manus turns from its plant angle toward psiOff over stance
 *   (holdWeight 10 favours it over the blade target). stanceSoft 0: stance only accepts exact solutions (no slip).
 * - Lift-off: the window keeps running in swing (psiRate rad/s, an estimate) with soft acceptance, so the
 *   foot leaves the ground on its stance branch; preSwingPsi blends the swing manus toward the last plant psi
 *   from preFrom of swing on.
 * - FORE_LOCK_STATS.release counts frames where the window had no exact solution and the scan took over.
 * All rates/weights here are estimates tuned against tests/fore-lock.test.ts. */
export const FORE_LOCK_STATS = { release: 0, solves: 0 };
export const FORE_LOCK = { psiRate: 30, sweep: 88 * Math.PI / 180, stanceShare: 1.8, psiOff: -.6, maxStep: .5, holdWeight: 10, nearest: 100, preFrom: .8, bladeRate: 40, nBlade: 4, nPsi: 6, fine: 2, on: 1, swing: 1, plant: 0, hold: 1, holdUntil: 0, soft: 1, stanceSoft: 0 };
export const FORE_SCAN = { psiFrom: -.6, psiTo: 1.2, psiStep: .1, bladeStep: .05 };
export function foreLimb(L: LimbDims, top: { z: number; y: number }, sole: Vec3, limits: JointLimits = CANID_LIMITS, prev?: { blade: number; psi: number; arm?: number }, psiWant?: number, any = false, girdle: GirdleLimits = GIRDLE, cont = FORE_CONT.carry, win?: { psi: number; blade: number; soft?: number; w?: number }) {
  const rest = L.girdleRest ?? 0, want = top.y - Math.hypot(top.y - sole.y, sole.x), nb = Math.round(girdle.scapulaMax / FORE_SCAN.bladeStep);
  let best = { blade: prev?.blade ?? rest, psi: prev?.psi ?? (L.footAngle ?? 0), arm: prev?.arm ?? rest, cost: Infinity, err: Infinity, ok: false };
  // v9 lock: a window about the previous solution (continuous, finer steps); none reachable -> the full scan below (release)
  let held: (typeof best & { locked: boolean }) | undefined;
  if (win && prev) {
    // v10: fixed sample counts (coarse grid +-nB x +-nP, then a fine pass +-1 coarse step about the coarse best), so the
    // cost per frame no longer grows as dt shrinks; blade samples clamped onto the same girdle limit are solved once
    const bLo = rest - girdle.scapulaMax, bHi = rest + girdle.scapulaMax;
    let lb = { blade: prev.blade, psi: prev.psi, arm: prev.arm ?? rest, cost: Infinity, err: Infinity, ok: false, locked: true };
    const grid = (b0: number, p0: number, db: number, dp: number, nB: number, nP: number) => {
      let lastBlade = NaN;
      for (let bi = -nB; bi <= nB; bi++) { const blade = Math.max(bLo, Math.min(bHi, b0 + db * bi));
        if (blade === lastBlade) continue; lastBlade = blade; // dedupe clamped samples (ascending order)
        for (let pj = -nP; pj <= nP; pj++) { const psi = p0 + dp * pj;
          FORE_LOCK_STATS.solves++;
          const LL = { ...L, footAngle: psi }, a = clampLimb(solveLimb(LL, false, sole, 0, { top, blade }), true, limits), s = soleOf(LL, a);
          const err = Math.hypot(s.z - sole.z, s.y - want), arm = a.girdle + a.leg + a.knee;
          const cost = (blade - arm) ** 2 + (psiWant === undefined ? 0 : (win.w ?? 1) * (psi - psiWant) ** 2);
          if (err < 1e-4 && cost < lb.cost) lb = { blade, psi, arm, cost, err, ok: true, locked: true };
          else if (!lb.ok && err < lb.err) lb = { blade, psi, arm, cost, err, ok: false, locked: true }; } } };
    const nB = FORE_LOCK.nBlade, nP = FORE_LOCK.nPsi, db = win.blade / nB, dp = win.psi / nP;
    grid(prev.blade, prev.psi, db, dp, nB, nP);
    if (FORE_LOCK.fine > 0) { const c = { ...lb }; const f = FORE_LOCK.fine; grid(c.blade, c.psi, db / f, dp / f, f, f); }
    if (lb.ok || (win.soft && lb.err < win.soft)) return lb;
    held = lb;
  }
  for (let bi = 0; bi <= 2 * nb; bi++) {
    const blade = rest + (bi % 2 ? 1 : -1) * Math.ceil(bi / 2) * FORE_SCAN.bladeStep; // rest outward
    for (let psi = FORE_SCAN.psiFrom; psi <= FORE_SCAN.psiTo + 1e-9; psi += FORE_SCAN.psiStep) {
      FORE_LOCK_STATS.solves++;
      const LL = { ...L, footAngle: psi }, a = clampLimb(solveLimb(LL, false, sole, 0, { top, blade }), true, limits), s = soleOf(LL, a);
      const err = Math.hypot(s.z - sole.z, s.y - want), ok = err < 1e-4;
      const arm = a.girdle + a.leg + a.knee;
      if (ok && any) return { blade, psi, arm, cost: 0, err, ok };
      const cost = (blade - arm) ** 2 + (prev ? (held ? FORE_LOCK.nearest : cont) * ((blade - prev.blade) ** 2 + (psi - prev.psi) ** 2) : 0) + (psiWant === undefined ? 0 : (psi - psiWant) ** 2);
      if (ok && (!best.ok || cost < best.cost)) best = { blade, psi, arm, cost, err, ok };
      else if (!ok && !best.ok && err < best.err) best = { blade, psi, arm, cost, err, ok };
    }
  }
  if (held && !best.ok) return held; // nothing reaches exactly anywhere: stay on the held branch (no flip)
  if (held) FORE_LOCK_STATS.release++;
  return best;
}
/** Chain top of a limb at rest (the blade pivot when the fore limb has a blade, else the top joint). */
const topY = (L: LimbDims) => L.hip + (L.girdle ?? 0);

/* ---------------------------------------------------------------- reach (what the limbs can sweep) */
export interface LimbRange { /** reachable sole interval at ground level, top at rest (m, +back) */ from: number; to: number; chord: number; centre: number }
/** The longest interval of ground points the clamped limb reaches within 0.1 mm: a 4 mm scan, edges bisected. Without
 * `body` the top is at rest over level ground; with it, ground point z (m, +back of the limb's hip) is seen from the limb
 * frame of a body standing in tilt `body.tilt` (bodies that run taller and pitched: runPose), and the foot range is taken
 * relative to the ground. */
export function limbRange(L: LimbDims, forward: boolean, front: boolean, ankle?: number, limits: JointLimits = CANID_LIMITS, body?: { tilt: Tilt; hip: readonly [number, number] }, girdle: GirdleLimits = GIRDLE): LimbRange {
  const span = 1.2 * (L.upper + L.lower + (L.foot ?? 0) + (L.girdle ?? 0)), step = .004, top = { z: 0, y: topY(L) };
  const at = (z: number): Vec3 => body ? worldToLimb({ x: body.hip[0], y: 0, z: body.hip[1] + z }, 0, 0, 0, body.tilt, body.hip) : { x: 0, y: 0, z };
  const ok = (z: number) => { const rel = at(z);
    if (ankle !== undefined) return hindFoot(L, top, rel, ankle, undefined, limits, body?.tilt.pitch ?? 0).ok;
    if (front && L.girdle) return foreLimb(L, top, rel, limits, undefined, undefined, true, girdle).ok;
    const a = clampLimb(solveLimb(L, forward, rel, 0, { top, fit: true }), front, limits);
    const s = soleOf(L, a); return Math.hypot(s.z - rel.z, s.y - (top.y - Math.hypot(top.y - rel.y, rel.x))) < 1e-4; };
  let best: [number, number] | null = null, run: number | null = null;
  for (let z = -span; z <= span + 1e-9; z += step) {
    if (ok(z)) { if (run === null) run = z; if (!best || z - run > best[1] - best[0]) best = [run, z]; } else run = null;
  }
  if (!best) return { from: 0, to: 0, chord: 0, centre: 0 };
  const edge = (inside: number, outside: number) => { for (let k = 0; k < 24; k++) { const m = (inside + outside) / 2; if (ok(m)) inside = m; else outside = m; } return inside; };
  const from = edge(best[0], best[0] - step), to = edge(best[1], best[1] + step);
  return { from, to, chord: to - from, centre: (from + to) / 2 };
}
/** Girdle capacity: how far the shoulder blade and pelvis may carry the top pivots (rad from rest, each way). */
export interface GirdleLimits {
  /** shoulder-blade swing each way from mid-stance (rad) */ scapulaMax: number;
  /** pelvis swing each way from mid-stance carried by the lumbar spine (rad) */ spineMax: number;
}
/**
 * Small-therian girdle ranges, pika (Ochotona rufescens, the lagomorph measured by cineradiography): scapula touchdown 46°,
 * lift-off 80° (34° of stance, ±0.30 rad), scapular retraction 66 % of fore step length (Fischer et al. 2002, JEB
 * 205:1315, doi:10.1242/jeb.205.9.1315; angles of the scapular spine against the horizontal, the convention of the same
 * lab: Schilling 2005, JEB 208:4013, "segment angles were calculated from the horizontal"). Run 4: the pelvis takes the
 * pika's own leading-limb stance excursion, touchdown 109° → lift-off 151° = 42° (±0.366 rad; the cranial pelvic angle
 * against the horizontal, effective stance movement 29-44° across the small therians: Schilling & Hackert 2006, JEB
 * 209:3925; v3 used the ~35° middle of the tailless range), the lumbar spine giving about half the hind step length in bounds
 * (same). The blade stays at the pika's 34°: the larger small-therian blade excursions (cui 42-43°, tree shrew 50-59°
 * touchdown → lift-off, Schilling 2005 Table 3) are walk/trot values of a rodent and a scandentian, not a lagomorph's. The
 * scapular pivot sits at hip height (Fischer et al. 2002), so both levers are the hip height.
 */
export const GIRDLE: GirdleLimits = { scapulaMax: .3, spineMax: .366 };
/** Share of each limb chord a planted foot may use (the clamp sits right at the reach edge) — game calibration. */
export const CHORD_USE = .9;
/**
 * Running posture — DERIVED: how far the hips rise above their standing height while running (`rise`, m), the shoulders
 * staying at theirs (the body pitches nose-down about the hips by asin(rise / trunk)). A crouched sitter (hare: hip .13 m on
 * a .33 m leg + foot) cannot sweep its hind foot through stance inside the gait's measured ankle range (LEPORID_LIMITS: no
 * foot under the hip below ~.20 m with the dog knee), so the rise is the one, of 0..RUN_POSE.maxRise in 5 mm steps, with the
 * longest fore + hind chords. With the dog ranges (wolf and others) the standing height already sweeps and rise stays small.
 */
/* Run 4 (grok): the trunk no longer pitches nose-down by the whole rise. `level` is the share of the hip rise the shoulders
 * share too (1 = the whole trunk rises level) and `pitch0` the neutral trunk pitch the bound's swing oscillates about (rad,
 * + nose up). Both are REFERENCE-MATCHED, not sourced: no measured running trunk pitch for Lepus was found; the side-on
 * reference (refs/hare/graze-alert-flight/attempt4-video-frames-6fps.jpg, bound rows) shows the trunk about level through the
 * extended suspension and nose-up at push-off, i.e. a near-level mean. The old shoulders-kept rule gave -16.6 deg neutral
 * (game, dog ranges; -27 deg with LEPORID_LIMITS). level 1 (truly level) costs the fore chord (.25 -> .09 m: the shoulders lift
 * off the fore reach) and the bound score (97.1 -> <89 %); .25 keeps both (fore .227, hind .541 m; score 97.1 %) at a
 * -9.2 deg neutral, the swing taking it to about -19..+1 deg. A level neutral needs more fore reach: open (Gait Builder). */
export interface RunPose { maxRise: number; step: number; level: number; pitch0: number }
export const RUN_POSE: RunPose = { maxRise: .12, step: .005, level: .25, pitch0: 0 };
/** Run 3 (grok-gait): the level-trunk running posture (shoulders rise with the hips: neutral pitch 0). Pass it to reachOf /
 * createBounding (opts.pose) with a body whose fore limb can reach from there (a blade: BodyPlan.scapula); RUN_POSE stays the
 * default so a body without one keeps its fore chord. */
export const RUN_POSE_LEVEL: RunPose = { ...RUN_POSE, level: 1 };
/** Tilt of a body risen `rise`·t at the hips (the shoulders by `level` of it), about the neutral pitch `pitch0`, plus the bound's pitch swing `swing` about the mid-trunk. */
export const runTilt = (sk: Skeleton, rise: number, t = 1, swing = 0, pose: RunPose = RUN_POSE): Tilt => { const p = -Math.asin(Math.min(.95, rise * t * (1 - pose.level) / sk.trunk)) + pose.pitch0 * t + swing, Hh = sk.legs.hind.hip;
  return { height: rise * t - sk.trunk / 2 * Math.sin(swing), pitch: p, roll: 0, shift: { y: Hh * (1 - Math.cos(p)), z: -Hh * Math.sin(p) } }; };
export interface Reach { fore: LimbRange; hind: LimbRange; body: { fore: ReachBody; hind: ReachBody }; girdle: GirdleLimits; /** running hip rise (m, RUN_POSE) */ rise: number;
  /** the fore limb carries its blade in the chain (BodyPlan.scapula): its chord already holds the blade swing, so no pivot shift */ foreBlade: boolean; pose: RunPose }
/**
 * Which part of the pitch swing a pair's stance sees — DERIVED from pitchCurve, which puts the nose lowest at mid fore stance
 * and highest at mid hind stance: a fore foot is down only while the nose is low or near level, a hind foot while it is high
 * or near level. `opposite` = the largest share of the other sign's swing (of BOUND_PITCH.max) a stance may see. Measured on
 * the curve (tests/bound-v3.test.ts, every score speed and row): fore stance swing <= +.095, hind >= -.094 rad, both at
 * 1.68 m/s (long duties); <= -.008 / >= +.022 from 3 m/s. So .5 x max (.1 rad) holds them all.
 */
export const STANCE_SWING = { opposite: .5 };
const reachCache = new WeakMap<Skeleton, Map<string, Reach>>();
/** Speeds (m/s) over which reachOf weighs a gait's sweep needs when it picks the running rise. */
export const RISE_SPEEDS = { from: 1.5, to: 12, step: .5 };
export function reachOf(sk: Skeleton, girdle: GirdleLimits = GIRDLE, pose: RunPose = RUN_POSE, gait?: BoundGait): Reach {
  const key = JSON.stringify([girdle, pose, gait ?? null]); let m = reachCache.get(sk); if (!m) reachCache.set(sk, m = new Map()); const hit = m.get(key); if (hit) return hit;
  // the running reach: the body's gait joint ranges (BodyPlan.limits) at the running posture (RUN_POSE), relative to the ground
  const H = sk.legs.hind, lim = sk.plan.limits ?? CANID_LIMITS, ankle = restAnkle(sk);
  // each chord holds over the pitch swing its stance sees: the interval common to the three tilts
  const meet = (rs: LimbRange[]): LimbRange => { const from = Math.max(...rs.map(r => r.from)), to = Math.min(...rs.map(r => r.to)), chord = Math.max(0, to - from);
    return chord > 0 ? { from, to, chord, centre: (from + to) / 2 } : { from: 0, to: 0, chord: 0, centre: 0 }; };
  // run 3: each pair only over the swing its own stance sees (STANCE_SWING), not the whole ±max
  const ranges = (rise: number) => { const tilts = (lo: number, hi: number) => [lo, 0, hi].map(w => runTilt(sk, rise, 1, w, pose)), M = BOUND_PITCH.max, q = STANCE_SWING.opposite;
    return { fore: meet(tilts(-M, q * M).map(tilt => limbRange(sk.legs, false, true, undefined, lim, { tilt, hip: sk.hips[0] }, girdle))),
      hind: meet(tilts(-q * M, M).map(tilt => limbRange(H, true, false, ankle, lim, { tilt, hip: sk.hips[1] }))) }; };
  // the rise: with a gait, the one that lets the most of its data duty fit — mean over RISE_SPEEDS of the smaller pair's
  // capacity / need (capped at 1; capacity = CHORD_USE x chord + the girdle term, as tools/bound-reach.ts counts it), ties to
  // the longer chords; without one, the longest fore + hind chords (as before run 3)
  const lever = H.hip, foreG = sk.legs.girdle ? 0 : 2 * girdle.scapulaMax * lever, hindG = 2 * girdle.spineMax * lever;
  const needs: [number, number][] = [];
  if (gait) for (let v = RISE_SPEEDS.from; v <= RISE_SPEEDS.to + 1e-9; v += RISE_SPEEDS.step) { const st = v / boundCadence(gait, v); needs.push([boundForeDuty(gait, v) * st, boundDuty(gait, v) * st]); }
  const score = (c: { fore: LimbRange; hind: LimbRange }) => (needs.length ? needs.reduce((a, [fn, hn]) => a + Math.min(1, (CHORD_USE * c.fore.chord + foreG) / fn, (CHORD_USE * c.hind.chord + hindG) / hn), 0) / needs.length : 0) * 10 + c.fore.chord + c.hind.chord;
  let best = { rise: 0, ...ranges(0) }, bestScore = score(best);
  for (let r = pose.step; r <= pose.maxRise + 1e-9; r += pose.step) { const c = ranges(r), sc = score(c); if (sc > bestScore + 1e-3) { best = { rise: r, ...c }; bestScore = sc; } }
  const { fore, hind, rise } = best;
  const foreLever = H.hip, hindLever = H.hip; // scapular pivot at hip height (Fischer et al. 2002)
  const body = (chord: number): ReachBody => ({ legChord: { walk: chord, trot: chord, gallop: chord }, trunk: sk.trunk, foreLever, hindLever, scapulaMax: girdle.scapulaMax });
  const out: Reach = { fore, hind, body: { fore: body(CHORD_USE * fore.chord), hind: body(CHORD_USE * hind.chord) }, girdle, rise, foreBlade: !!sk.legs.girdle, pose };
  m.set(key, out); return out;
}
/** Top-pivot shifts (m, +back) the girdles really give at one set of leg phases: the fore pivots as far as the capped shoulder
 * blade carries them (reachTargets' glide is not used), both hind pivots by the one pelvis (mean shift, capped at spineMax). */
export function girdleShifts(plan: CanidPlan, legPhases: readonly number[], reach: Reach, spineUse = 0, foreDuty = plan.duty) {
  const at: CanidPlan = { ...plan, offsets: legPhases }, tf = reachTargets({ ...at, duty: foreDuty }, 0, reach.body.fore), hb = reach.body.hind;
  // the back takes spineUse of the hind sweep (up to its range) even where the limb could do it alone (Bramble 1989:
  // the flexing back is part of the stride), so the hind limb's chord in reachTargets shrinks by that much
  const sweep = plan.duty * plan.stride, byBack = spineUse * Math.min(sweep, 2 * reach.girdle.spineMax * hb.hindLever);
  const chord = Math.max(0, Math.min(hb.legChord.gallop, sweep - byBack)), th = reachTargets(at, 0, { ...hb, legChord: { walk: chord, trot: chord, gallop: chord } });
  const cap = reach.girdle.spineMax, spineFlex = Math.max(-cap, Math.min(cap, th.spineFlex)), hind = -spineFlex * reach.body.hind.hindLever;
  // a fore limb with its blade in the chain swings it inside its own chord (foreLimb): no extra pivot shift
  const fs = (k: number, gl: number) => reach.foreBlade ? 0 : tf.girdle[k] - gl;
  return { shift: [fs(0, tf.glide[0]), hind, fs(2, tf.glide[1]), hind], spineFlex, pitch: (tf.pitch + th.pitch) / 2 };
}
/** Do the duties fit (`duty` = hind, `foreDuty` = fore): every stance foot stays within CHORD_USE x its chord of its (shifted)
 * pivot over the whole stride? */
function dutyFits(base: Omit<CanidPlan, 'duty' | 'suspensions'>, duty: number, foreDuty: number, reach: Reach, spineUse: number, n = 240) {
  const plan: CanidPlan = { ...base, duty, suspensions: [] };
  for (let k = 0; k < n; k++) {
    const ph = plan.offsets.map(o => frac(k / n + o)), g = girdleShifts(plan, ph, reach, spineUse, foreDuty);
    for (let i = 0; i < 4; i++) { const d = FRONT(i) ? foreDuty : duty; if (ph[i] < d) {
      // fore: the planned chord; hind: the full chord - the margin takes the shared pelvis' residual (gaitData hindResidual)
      const chord = FRONT(i) ? reach.body.fore.legChord.gallop : reach.hind.chord;
      if (Math.abs(d * plan.stride * (ph[i] / d - .5) - g.shift[i]) > chord / 2 + 1e-6) return false;
    } }
  }
  return true;
}

/* ---------------------------------------------------------------- plan */
export interface BoundPlan {
  row: BoundRowId; speed: number; hz: number; stride: number;
  /** HIND duty the data asks for, and the one used: the largest <= data that the limbs + girdles can sweep (dutyFits) */ dutyData: number; duty: number;
  /** the same for the fore feet (BoundGait foreShare x hind), fitted on its own when the limbs cannot sweep it (run 4) */ foreDutyData: number; foreDuty: number;
  /** per leg (LF, LH, RF, RH): the duties used, and the data's */ duties: number[]; dutiesData: number[];
  offsets: number[]; suspensions: Suspension[];
  /** share of the hind sweep the back carries (spineUse) */ spineUse: number;
  /** the plan in gaitData's CanidPlan shape (gait 'gallop'), for reachTargets */ canid: CanidPlan;
}
/** How much the back flexes into the stride: stiff-backed at and below the transition speed, flexed-back from `fullAt`
 * (Bertram & Gutmann 2009: slow half-bounds stiff-backed, fast ones flexed-back) — the ramp between is [estimate]. */
export const SPINE_USE = { fullAt: 5 };
export function spineUse(g: BoundGait, speed: number) {
  const a = g.cadence.transitionSpeed, b = Math.max(a + .1, SPINE_USE.fullAt), t = Math.max(0, Math.min(1, (Math.abs(speed) - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
const planCache = new Map<string, [number, number]>();
export function boundPlan(g: BoundGait, speed: number, reach: Reach, row: BoundRowId): BoundPlan {
  const v = Math.max(.05, Math.abs(speed)), hz = boundCadence(g, v), stride = v / hz, dutyData = boundDuty(g, v), foreDutyData = boundForeDuty(g, v), offsets = rowOffsets(boundRows(g)[row]);
  const base = { gait: 'gallop' as const, froude: 0, hz, stride, offsets }, use = spineUse(g, v);
  // the fitted shares of the data duties, cached per 1 cm/s (bisection over a sampled stride is too slow per frame). Run 4:
  // each pair is fitted on its own — first both together (the largest common share), then each pair raised alone up to its
  // data duty with the other held — because a pair's contact is limited by its own reach (v3 cut the hind with the fore)
  const key = `${row}|${Math.round(v * 100)}|${reach.fore.chord}|${reach.hind.chord}|${reach.girdle.spineMax}|${reach.girdle.scapulaMax}|${JSON.stringify(g)}`;
  let shares = planCache.get(key);
  if (shares === undefined) {
    const fits = (h: number, f: number) => dutyFits(base, h * dutyData, f * foreDutyData, reach, use);
    const raise = (ok: (m: number) => boolean, lo: number) => { if (ok(1)) return 1; let hi = 1; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; } return lo; };
    if (fits(1, 1)) shares = [1, 1];
    else { const both = fits(.01, .01) ? raise(m => fits(m, m), .01) : .01, h = raise(m => fits(m, both), both); shares = [h, raise(m => fits(h, m), both)]; }
    if (planCache.size > 5000) planCache.clear(); planCache.set(key, shares);
  }
  const duty = shares[0] * dutyData, foreDuty = shares[1] * foreDutyData, duties = [foreDuty, duty, foreDuty, duty], dutiesData = [foreDutyData, dutyData, foreDutyData, dutyData];
  const sus = suspensions(offsets, duties);
  return { row, speed: v, hz, stride, dutyData, duty, foreDutyData, foreDuty, duties, dutiesData, offsets, suspensions: sus, spineUse: use, canid: { ...base, duty, suspensions: sus } };
}

/* ---------------------------------------------------------------- body pitch through the bound */
/**
 * Body pitch through the bound — DERIVED, not measured: no lagomorph trunk-pitch excursion was found (searched 2026-10-21:
 * Bertram & Gutmann 2009, Schilling & Hackert 2006 and Fischer et al. 2002 give spine and girdle angles, not the trunk's pitch).
 * Rule: the vertical ground force of each planted foot is a half-sine over its stance; per stride the feet carry the body
 * weight, the fore and hind pairs `foreShare` / 1 − foreShare of it (equal for a centre of mass midway between the girdles,
 * which also makes the stride's net pitching impulse zero); each pair's force acts trunk/2 ahead of / behind that centre and
 * pitches the body (inertia m·k², k = the radius of gyration of a uniform rod `lengthPerTrunk` × the trunk long). Integrated
 * over the stride as a steady (periodic, zero-mean) oscillation: fore support pitches the nose up, hind support down, so the
 * nose is lowest at mid fore stance and highest at mid hind stance (falling through the extended flight, rising through the gathered one). All three numbers are
 * [estimate]s; horizontal forces aimed at the centre of mass would reduce the swing, so it is an upper bound, capped at `max`.
 */
export const BOUND_PITCH = { foreShare: .5, lengthPerTrunk: 2, max: .2 };
const pitchCache = new Map<string, number[]>();
export function pitchCurve(plan: BoundPlan, sk: Skeleton, n = 200): number[] {
  const key = `${plan.row}|${plan.hz}|${plan.duties.join(',')}|${plan.offsets.join(',')}|${sk.trunk}`, hit = pitchCache.get(key); if (hit) return hit;
  const T = 1 / plan.hz, dt = T / n, L = sk.trunk / 2, k = BOUND_PITCH.lengthPerTrunk * sk.trunk / Math.sqrt(12), share = [BOUND_PITCH.foreShare, 1 - BOUND_PITCH.foreShare];
  const om: number[] = []; let w = 0;
  for (let s = 0; s < n; s++) {
    let tau = 0;
    for (let i = 0; i < 4; i++) { const d = plan.duties[i], ph = frac(s / n + plan.offsets[i]); if (ph < d && d > 0) {
      const A = share[FRONT(i) ? 0 : 1] / 2 * gravity() * T * Math.PI / (2 * d * T); tau += (FRONT(i) ? L : -L) * A * Math.sin(Math.PI * ph / d); } }
    w += tau / (k * k) * dt; om.push(w);
  }
  const wm = om.reduce((a, b) => a + b, 0) / n, th: number[] = []; let t = 0;
  for (const o of om) { t += (o - wm) * dt; th.push(t); }
  const tm = th.reduce((a, b) => a + b, 0) / n, out = th.map(x => Math.max(-BOUND_PITCH.max, Math.min(BOUND_PITCH.max, x - tm)));
  if (pitchCache.size > 2000) pitchCache.clear(); pitchCache.set(key, out); return out;
}
export const pitchAt = (curve: number[], stridePhase: number) => { const x = frac(stridePhase) * curve.length, i = Math.floor(x), f = x - i; return curve[i % curve.length] * (1 - f) + curve[(i + 1) % curve.length] * f; };

/**
 * Body height through the bound — DERIVED (T-0009 v5, grok-gait). The same half-sine vertical ground forces as pitchCurve (each
 * pair carries foreShare / 1 − foreShare of the body weight per stride), minus g, integrated twice as a steady periodic
 * oscillation (zero-mean vertical velocity; height 0 = the lowest point while a foot is down). Between footfalls the body is ballistic, so
 * every suspension is a g·t²/8 parabola (gaitData suspensionRise), joined to the dip the same forces give in stance: the CoM
 * is highest in the flight and lowest in support, as in any bouncing gait (Cavagna, Heglund & Taylor 1977, Am J Physiol
 * 233:R243; force shape: Alexander & Jayes 1978, J Zool 185:27, shape factor 0 = half-sine [assumption, as pitchCurve]).
 * v4 drew only a g·t²/8 hump inside each suspension and nothing in stance (hare 8.5 m/s: 7.5 mm); with the stance part the
 * stride's span at 8.5 m/s is ~16 mm. The span is physics, not a choice: Hildebrand 1977's hare duties leave ~120 ms of flight
 * per stride at 4.4 Hz, and a body moving 8.5 m/s with that flight time cannot rise further.
 */
const heightCache = new Map<string, number[]>();
export function heightCurve(plan: BoundPlan, n = 200): number[] {
  const key = `${plan.row}|${plan.hz}|${plan.duties.join(',')}|${plan.offsets.join(',')}`, hit = heightCache.get(key); if (hit) return hit;
  const T = 1 / plan.hz, dt = T / n, share = [BOUND_PITCH.foreShare, 1 - BOUND_PITCH.foreShare], g = gravity(), vel: number[] = []; let v = 0;
  for (let s = 0; s < n; s++) {
    let a = -g;
    for (let i = 0; i < 4; i++) { const d = plan.duties[i], ph = frac(s / n + plan.offsets[i]); if (ph < d && d > 0) a += share[FRONT(i) ? 0 : 1] / 2 * g * Math.PI / (2 * d) * Math.sin(Math.PI * ph / d); }
    v += a * dt; vel.push(v);
  }
  const vm = vel.reduce((p, q) => p + q, 0) / n, y: number[] = []; let h = 0;
  for (const u of vel) { h += (u - vm) * dt; y.push(h); }
  // zero: the lowest the body sinks while a foot is down, so a stance limb never has to fold further than at the running rise
  // reachOf picked (a zero-mean curve sank the body 7 mm in stance and the limbs hit their flexion ends: up to 6.5 mm slip)
  let low = Infinity; for (let s = 0; s < n; s++) if (plan.offsets.some((o, i) => frac(s / n + o) < plan.duties[i])) low = Math.min(low, y[s]);
  const out = y.map(q => q - (low < Infinity ? low : 0));
  if (heightCache.size > 2000) heightCache.clear(); heightCache.set(key, out); return out;
}
/**
 * Swing feet while moving (T-0009 v5). `fold` = peak clearance of the swing-foot target as a share of the limb's hip height
 * (v4: .25 for both pairs). The hind target now rises .8 x the hip height at mid-swing, so the hind limb folds deeply in
 * swing - the knee and ankle reach the measured flexion ends the clamped IK enforces (BodyPlan.limits = LEPORID_LIMITS:
 * knee 30 deg, Hildebrand, Holmberg & Shrive 2003 / Zhang 2024; ankle 66.4 deg, Hall et al. 2022 PeerJ 10:e13611) - trailing
 * in the extended suspension and drawn up and forward under the trunk into the gathered one (Bramble 1989, Am Zool 29:171).
 * .8 is the largest fold at which no hind sole rises above its own hip joint at 5-11.6 m/s (tests/bound-v5.test.ts): with no
 * measured hip-extension limit, .9 and up drove the folded foot over the rump and 1.2+ onto the back (lookscore v1.2
 * rewarded that - see the T-0009 grok-gait handoff v5). [estimate, bounded by that geometric rule]. Fore: .25 kept (grid .1 /
 * .25 / .5 flat). A swinging foot also rides with the ballistic body (heightCurve) in flight instead of reaching back down.
 */
export const SWING = { fold: { fore: .25, hind: .8 } };
/**
 * v6 (T-0009 run 6, grok-gait): late-swing fore reach. Late in swing the fore target (stepFoot: the landing point ahead plus the
 * swing arc's clearance plus the ballistic body lift) lies beyond what the limb reaches (8.5 m/s hare: 205-255 mm from the
 * glenoid, limb .187 m), and the IK then points the straightened limb at it: the paw ends on the ray from the glenoid, ~30 mm
 * ABOVE the swing's own height. Since BodyPlan.girdleTop (b774a5e: the hare's blade pivot .17 m, the glenoid ~40 mm higher)
 * that ray put the reaching paws 45-58 mm above the ground in the extended flight (probe, handoff run 6), higher under the
 * body than the stretch references (lookscore v1.3 overlays: game fore legs above the reference fore legs). Fix: from `from`
 * to `full` of the swing (fraction, 0 lift-off .. 1 touchdown) an unreachable fore target is pulled back, at its own height,
 * onto the reach circle (`reach` x the straight limb) about the protracted glenoid (blade at rest + GIRDLE.scapulaMax), held to
 * `hold`, then let go by touchdown: the paw keeps the swing's ground clearance and reaches as far forward as the limb allows.
 * It depends on the body's own glenoid (girdleTop, scapula) and limb lengths, not on a fixed angle. Timing [estimate]: after
 * the gathered and push-off cells (v5: protraction from stride .7 wrecked gather / push); `reach` .995 [estimate: the IK's
 * straight-limb tolerance]. SOURCE CHECK: the resulting forearm lies 34-44 deg below the horizontal (probe), past the 11-36 deg
 * measured at fore touchdown in small therians (Schmidt 2008 JEB 211:3775 Table 4; pika 33 deg, Fischer et al. 2002 JEB
 * 205:1315) - no hare forelimb swing kinematics were found; flagged in the handoff.
 */
export const FORE_REACH = { from: .6, full: .7, hold: .92, reach: .995 };
/**
 * v7 (T-0009 run 7, grok-gait): fore touchdown. The fore stance sweep (foreDuty x stride, .276 m for the hare at every speed)
 * sits at the back end of the fore chord (run 4: fore prints behind the hinds), so a fore paw lands ~95-120 mm ahead of and
 * ~100 mm below the glenoid, inside the limb's reach: the elbow is folded at contact and folds further as the body runs over
 * the paw. At 11.6 m/s the body covers 48 mm per 240 Hz frame, so the frames either side of contact caught the forearm at
 * 3-5 deg below the horizontal (interpolated contact 5.7 deg) against the 11-36 deg measured at fore touchdown in small
 * therians (Schmidt 2008 JEB 211:3775 Table 4; pika 33 deg, Fischer et al. 2002 JEB 205:1315). Not the reach ease-off:
 * FORE_REACH.hold .85-.92 leaves every touchdown angle unchanged (probe, handoff run 7). Fix: from `from` to `to` m/s the
 * landing point moves `ahead` (m) forward, only from swing `swingFrom` to `swingTo` (the target there still lies beyond the
 * reach circle), so the paw lands with the limb more extended. Below `from` nothing changes: the 8.5 m/s stride sheets the
 * lookscore uses are untouched (a full step from 5 m/s moved the mid-swing fore paws 12-14 mm and cost winter push 96.0 ->
 * 93.3). With the forward landing the late-swing reach circle shrinks by `reachCut` x the step (reach .995 -> .985 at full
 * step), keeping the late-swing forearm under 36 deg (36.0 without it). `ahead` .035 [estimate, grid .015-.045 in the
 * handoff]: the smallest step that holds 11.6 m/s touchdowns at or above 11 deg at 240 Hz; ramp ends [estimate].
 * Only fore limbs with a scapula (L.girdle): the host plan (no scapula) lands with the elbow at ~160 deg and the forearm at
 * 22-33 deg already, and the step put its paws out of reach (11.6 m/s: leash steps, slip 9.7 mm; bound-checks host 99.1 -> 94.7).
 * v8: the ramp ends at 10 m/s (was 11.6): at 10 m/s the half step left contact at 8.5 deg (240 Hz, contact scorer).
 */
export const FORE_TOUCH = { ahead: .035, reachCut: .01, from: 8.5, to: 10, swingFrom: .8, swingTo: .95 };
/** FORE_TOUCH: how far (m) the running fore landing point moves forward at speed `v` (m/s): 0 up to `from`, `ahead` from `to` (smoothstep). */
export function foreTouchAhead(v: number, t = FORE_TOUCH) { const k = Math.max(0, Math.min(1, (v - t.from) / (t.to - t.from))); return t.ahead * k * k * (3 - 2 * k); }
/** Weight of the late-swing fore reach at swing fraction `sp` (0 lift-off .. 1 touchdown). */
export function foreReachWeight(sp: number, r = FORE_REACH) {
  const ss = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
  return sp <= r.from || sp >= 1 ? 0 : sp < r.full ? ss((sp - r.from) / (r.full - r.from)) : sp <= r.hold ? 1 : 1 - ss((sp - r.hold) / (1 - r.hold));
}
/** FORE_REACH: an out-of-reach fore target (limb frame, +z back) pulled back at its own height onto the reach circle about the
 *  protracted glenoid of a limb whose chain top is `top`; a reachable target is returned unchanged. */
export function foreReachTarget(L: LimbDims, top: { z: number; y: number }, rel: Vec3, girdle: GirdleLimits = GIRDLE, r = FORE_REACH): Vec3 {
  const b = (L.girdleRest ?? 0) + girdle.scapulaMax, gz = top.z - (L.girdle ?? 0) * Math.sin(b), gy = top.y - (L.girdle ?? 0) * Math.cos(b);
  const R = r.reach * (L.upper + L.lower + (L.foot ?? 0)), dy = Math.hypot(rel.y - gy, rel.x), dz = rel.z - gz;
  if (dz >= 0 || dy >= R || Math.hypot(dz, dy) <= R) return rel;
  return { ...rel, z: gz - Math.sqrt(R * R - dy * dy) };
}

/* ---------------------------------------------------------------- pose requests (agent pipeline → body) */
export type PoseKind = 'stand' | 'graze-crouch' | 'sit-up' | 'half-sit' | 'scan' | 'rest' | 'crouch';
/** What the agent pipeline may ask of a standing body. `weight` 0..1 blends from 'stand' (default 1). */
export interface PoseRequest { kind: PoseKind; weight?: number }
/** Body shape per request: pitch (rad, + front up, about the hip), drop (m, hip lowered), fore lifted off the ground. */
export interface PoseShape { pitch: number; drop: number; foreLift: boolean; /** run 9: fore feet re-planted this far (m) ahead of their standing place (a grazing hare reaches its fore paws forward under the chin) */ ahead?: number }
/** Values from the host's hare.ts POSES (grok, [estimate] there: drawn to photos); 'stand' is the rest skeleton. */
export const POSE_SHAPES: Record<PoseKind, PoseShape> = {
  stand: { pitch: 0, drop: 0, foreLift: false },
  /** run 7 (grok): drop .02 -> .04 asked; the hare's limbs reached only .43 of it (pitch -.043, hip -.017 m): with the fore paw
   *  under the glenoid the bladed fore limb is already at its elbow clamp (CANID elbow min 50 deg) standing, so it cannot fold
   *  further. Run 9 (grok): the fore paws step 6 cm ahead first (`ahead`; a grazing hare reaches its fore paws forward under the
   *  chin, refs/hare/graze-alert-flight attempt2 panel 1), then the body lowers the full pitch -.06 / drop .04 with every joint
   *  inside its clamp and every sole below its own hip / shoulder (posePlausibility). Grid (box, lookscore v1.3 graze strips,
   *  C:\dev\rabbit-rec13\look\grid-graze.txt): ahead 0 / .05 / .06 / .07 x pitch 0 .. -.1 x drop .02 .. .06; drop .06 zeroes
   *  (fore paw over the shoulder), level drops lift the chest bone and score lower. REFERENCE-MATCHED, not sourced.
   *  Run 10 (grok): the shoulder girdle is raised (BodyPlan.girdleTop .17, hare.ts), so the fore limb stands with its elbow
   *  27 mm below the glenoid at 71 deg interior instead of folded in a Z at its 50 deg clamp, and it folds the full pitch / drop
   *  with the paws where they stand: `ahead` back to 0 (box grid C:\dev\rabbit-rec14\grid-run10.txt, G1 ahead .06 vs G3 ahead 0
   *  within noise; G2 drop .05 lost winter crouch). */
  'graze-crouch': { pitch: -.06, drop: .04, foreLift: false, ahead: 0 },
  /** upright sit-up on the haunches, fore paws lifted (run 7, grok): pitch 1.15 rad (66 deg) and the hip .02 m lower, so the
   *  silhouette axis is 66-70 deg like refs/hare/graze-alert-flight attempt2 / attempt3 panel 3 (68.9 / 70.8 deg, lookscore
   *  masks). REFERENCE-MATCHED, not sourced; the hind feet reach it within 1 mm (drop .04 would miss by 15 mm). Was .95 / 0.
   *  Run 12 (grok): pitch 1.15 -> 1.3 (74 deg) with the hare's sit hunch (hare.ts POSES sit [7]): the hunched back shortens
   *  the axis, so the body rises to keep the references' outline (box grid S1/S4/S6, C:\dev\rabbit-rec16\grid-run12.txt).
   *  REFERENCE-MATCHED, not sourced. */
  'sit-up': { pitch: 1.3, drop: .02, foreLift: true },
  /** alert freeze (grok run 4): front raised ~20 deg on straight forelegs, all four feet down, the head up. REFERENCE-MATCHED
   *  (attempt4 video 2.3-3.3 s and attempt2 panel 3: the hare raises the head on all fours, it does not stand up on the haunches). */
  'half-sit': { pitch: .35, drop: 0, foreLift: false },
  scan: { pitch: .3, drop: 0, foreLift: false },
  rest: { pitch: -.04, drop: .035, foreLift: false },
  crouch: { pitch: -.06, drop: .045, foreLift: false },
};
/** The host's coarse body pose (animals/hare.ts derives it from the headless sim state). */
export type HostPose = 'head-down' | 'head-up' | 'move' | 'run' | 'rest' | 'crouch';
/** Adapter from the host's pose (and action, to tell an alert sit-up from a scan). Moving poses ask for nothing. */
export function poseRequestFor(pose: HostPose, action?: string): PoseRequest | null {
  switch (pose) {
    case 'head-down': return { kind: 'graze-crouch' };
    case 'head-up': return { kind: action === 'scan' ? 'scan' : 'half-sit' };
    case 'rest': return { kind: 'rest' };
    case 'crouch': return { kind: 'crouch' };
    default: return null;
  }
}

/** Worst sole error (m) of the planted feet of a standing body at pitch `pitch` (about the hip) and hip drop `drop`. */
export function standError(sk: Skeleton, pitch: number, drop: number, foreLift: boolean, ahead = 0) {
  const H = sk.legs.hind, tilt: Tilt = { height: -drop, pitch, roll: 0, shift: { y: H.hip * (1 - Math.cos(pitch)), z: -H.hip * Math.sin(pitch) } }, ankle = restAnkle(sk);
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const front = FRONT(i); if (front && foreLift) continue;
    const L = front ? sk.legs as LimbDims : H, foot = { x: sk.hips[i][0], y: 0, z: sk.hips[i][1] - (L.stance ?? 0) - (front ? ahead : 0) };
    const rel = worldToLimb(foot, 0, 0, 0, tilt, sk.hips[i]), top = { z: 0, y: topY(L) };
    // run 7 (grok): a fore limb with its blade in the chain is solved as the controller solves it (foreLimb), not as a bare
    // two-bone leg, which missed the ground by 33 mm on the hare and so zeroed poseReach for every four-foot pose
    if (front && L.girdle) { worst = Math.max(worst, foreLimb(L, top, rel).err); continue; }
    const LL = front ? L : { ...L, footAngle: hindFoot(L, top, rel, ankle).psi }, a = clampLimb(solveLimb(LL, !front, rel, 0, { top, fit: true }), front), s = soleOf(LL, a);
    worst = Math.max(worst, Math.hypot(s.z - rel.z, s.y - (top.y - Math.hypot(top.y - rel.y, rel.x))));
  }
  return worst;
}
/** How far (0..1) toward a pose shape a skeleton can go with every planted foot reached within 2 mm: requests are
 * followed as far as the limbs allow (a short-legged body cannot drop its chest as far). Bisection; cached per skeleton. */
export const POSE_REACH = .002;
const poseCache = new WeakMap<Skeleton, Map<PoseKind, number>>();
export function poseReach(sk: Skeleton, kind: PoseKind) {
  let m = poseCache.get(sk); if (!m) poseCache.set(sk, m = new Map()); const hit = m.get(kind); if (hit !== undefined) return hit;
  const sh = POSE_SHAPES[kind], err = (w: number) => standError(sk, sh.pitch * w, sh.drop * w, sh.foreLift, sh.ahead ?? 0); // the fore feet step `ahead` first, then the body lowers
  let w = 1; if (err(1) > POSE_REACH) { let lo = 0, hi = 1; for (let k = 0; k < 16; k++) { const c = (lo + hi) / 2; if (err(c) <= POSE_REACH) lo = c; else hi = c; } w = lo; }
  m.set(kind, w); return w;
}

/* ---------------------------------------------------------------- turning in place */
/**
 * Turning on the spot steps the feet (no spinning on planted feet). Pattern reused from procedural walkers (the same
 * threejs-procedural-spider foot model foot.ts follows, majidmanzarpour, MIT): a planted foot re-plants when it is more
 * than `replant` from where it should stand for the body's current heading, one step at a time per pair so a fore and a
 * hind foot are always down (sequence by largest error; at most two feet up, never both of a pair). The body yaws toward
 * the asked heading at most `rate`. Values are [estimate]s, no measured leporid turn-in-place found: `rate` .9 rad/s
 * (~52°/s, a quarter turn in ~1.7 s) is the fastest at which every planted foot stays within 1 cm of its print with
 * `step` .15 s steps (tests/bound-v3.test.ts); `replant` 3 cm. Standing still only: a moving body turns by its stride.
 * Opt-in per controller (BoundOptions.turnInPlace) because the host must then draw the frame's heading, not its own.
 */
export const TURN = { rate: .9, replant: .03, step: .15 };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---------------------------------------------------------------- controller */
export interface BoundFrame {
  plan: BoundPlan; stride: number; phases: number[];
  /** clamped limb angles and the chain tops actually used (limb frame) */ limbs: LimbAngles[]; tops: { z: number; y: number }[];
  /** world target per foot and the world sole the clamped limb reaches (the toe tip; for a split hind foot see `mtp`) */ feet: Vec3[]; soles: Vec3[];
  /** split hind foot: world MTP joint the IK solved (= soles when the plan has no toes) */ mtp: Vec3[];
  contact: boolean[]; touchdowns: { leg: number; at: Vec3 }[];
  /** per foot: |rendered sole − planted foot| (m), 0 in swing */ slip: number[];
  x: number; z: number; /** the body's heading (follows the asked one at TURN.rate when standing) */ heading: number; tilt: Tilt; spineFlex: number; lift: number; pose: PoseKind; leashes: number;
  /** standing and still yawing toward the asked heading, or re-planting for it */ turning: boolean; /** turn re-plant steps so far */ turnSteps: number;
}
export interface BoundController {
  update(dt: number, speed: number, heading: number, request?: PoseRequest | null, row?: BoundRowId): BoundFrame;
  /** put the body at (x, z, heading) with the feet at rest under it (a host that moves its animal itself, e.g. after a teleport) */
  place(x: number, z: number, heading: number): void;
  readonly reach: Reach; readonly skeleton: Skeleton;
  /** T-0009 run 10 (grok): the host's per-instance fore-lock switch at runtime (BoundOptions.foreLock is the start value), so
   *  a rendered animal can move in and out of the nearest few without rebuilding its rig. Off clears the plant-time psi the lock
   *  keeps, so off is exactly the run-8 scan path again. */
  setForeLock(on: boolean): void; readonly foreLock: boolean;
}
/** World points of limb `i` in a frame: [chain top, girdle joint, knee/elbow, ankle/wrist, toe] (for drawing bones); a split
 * hind foot (BodyPlan.hindToes) adds the toe tip after the MTP joint: [top, hip, knee, hock, MTP, toe tip]. With a blade
 * (BodyPlan.scapula) the top is the blade pivot and the girdle joint the glenoid. Indices 1..4 keep their meaning either way. */
export function limbPoints(sk: Skeleton, frame: BoundFrame, i: number): Vec3[] {
  const L: LimbDims = FRONT(i) ? sk.legs : sk.legs.hind, a = frame.limbs[i], dir = (u: number) => ({ z: -Math.sin(u), y: -Math.cos(u) });
  const a1 = a.girdle + a.leg, a2 = a1 + a.knee, a3 = a2 + a.wrist, j = a.joint, top = frame.tops[i];
  const k = { z: j.z + L.upper * dir(a1).z, y: j.y + L.upper * dir(a1).y }, w = { z: k.z + L.lower * dir(a2).z, y: k.y + L.lower * dir(a2).y };
  const f = { z: w.z + (L.foot ?? 0) * dir(a3).z, y: w.y + (L.foot ?? 0) * dir(a3).y };
  const P = [top, j, k, w, f].map(p => limbToWorld({ x: 0, y: p.y, z: p.z }, frame.x, frame.z, frame.heading, frame.tilt, sk.hips[i]));
  if (!FRONT(i) && sk.toes > 0) P.push({ ...frame.soles[i] });
  return P;
}
/** Leash: a planted foot the clamped limb cannot reach by this much steps (counted; the score fails any). */
export const BOUND_LEASH = .01;
export interface BoundOptions {
  /** running posture (RUN_POSE default; RUN_POSE_LEVEL for a level trunk) */ pose?: RunPose;
  /** turn in place by re-planting (TURN): a standing body yaws toward the asked heading at TURN.rate and steps its feet; the
   *  frame's `heading` is then the body's, which the host must draw (off = the old behaviour, the heading taken at once) */ turnInPlace?: boolean;
  /** T-0009 run 10: fore-stance IK solution lock (FORE_LOCK) for this controller. Default off = the old full scan (run 8
   *  behaviour). Meant for the embodied hare and the nearest few; FORE_LOCK.on stays a global kill switch. */ foreLock?: boolean;
}

export function createBounding(sk: Skeleton, gait: BoundGait, ground: TerrainFn, start: { x: number; z: number; heading: number }, girdle: GirdleLimits = GIRDLE, opts: BoundOptions = {}): BoundController {
  let lockOn = !!opts.foreLock; const pose = opts.pose ?? RUN_POSE, reach = reachOf(sk, girdle, pose, gait), H = sk.legs.hind;
  const limbOf = (i: number) => FRONT(i) ? sk.legs as LimbDims : H;
  // where a foot rests: standing (fore under the glenoid, hind MTP `stance` ahead) → the centre of its running chord
  // a hind sweep shorter than the chord sits at the chord's front end (the hind prints land ahead: Lagomorpha Locomotion 2021);
  // run 4: a fore sweep shorter than its chord sits at the chord's back end, so the fore prints fall behind the hinds (snowshoe
  // tracks: two hind prints ahead of the two fore prints — Montana Natural History Center; Canadian Wildlife Federation 2004)
  // run 9: a standing pose may set the fore feet `ahead` (PoseShape.ahead, m forward = -z): they re-plant there (below)
  let run = 0, hindSlack = 0, foreSlack = 0, foreAhead = 0, foreTouch = 0; const touchW = [0, 0, 0, 0]; const centre = (i: number) => FRONT(i) ? lerp(-(sk.legs.stance ?? 0) - foreAhead, reach.fore.centre + foreSlack - foreTouch * touchW[i], run) : lerp(-(H.stance ?? 0), reach.hind.centre - hindSlack, run);
  let x = start.x, z = start.z, heading = start.heading, row: BoundRowId = 'half-bound', leashes = 0, stridePhase = 0, turnSteps = 0;
  // the foot state holds the toe tip; a split hind foot's MTP sits `toes` behind it (BodyPlan.hindToes)
  const toeOff = (i: number) => FRONT(i) ? 0 : sk.toes;
  const restWorld = (i: number, px = x, pz = z, h = heading) => { const w = toWorld(px, pz, h, sk.hips[i][0], sk.hips[i][1] + centre(i) - toeOff(i)); return { x: w.x, y: ground(w.x, w.z), z: w.z }; };
  const feet: FootState[] = [0, 1, 2, 3].map(i => footState(restWorld(i)));
  let plan = boundPlan(gait, .05, reach, row); const cpg: Cpg = createCpg(plan.offsets);
  const pitchS: Spring = spring(0), dropS: Spring = spring(0), liftS: Spring = spring(0), moveS: Spring = spring(0);
  const gaitLimits = sk.plan.limits ?? CANID_LIMITS, turnStep = [false, false, false, false];
  const lockPsi = [0, 0, 0, 0], plantPsi: (number | undefined)[] = [undefined, undefined, undefined, undefined]; let wasDown = feet.map(() => true), lastPose: PoseKind = 'stand'; const ankle0 = restAnkle(sk), prevPsi: (number | undefined)[] = [undefined, sk.restFootAngle, undefined, sk.restFootAngle];
  const prevFore: ({ blade: number; psi: number; arm?: number } | undefined)[] = [undefined, undefined, undefined, undefined];
  return { reach, skeleton: sk, get foreLock() { return lockOn; }, setForeLock(on: boolean) { if (lockOn && !on) plantPsi.fill(undefined); lockOn = on; }, place(px, pz, h) { x = px; z = pz; heading = h; for (let i = 0; i < 4; i++) { const f0 = footState(restWorld(i)); Object.assign(feet[i], f0); wasDown[i] = true; turnStep[i] = false; } },
  update(dt, speed, h, request, force) {
    const v = Math.abs(speed), moving = v > .05; foreTouch = foreTouchAhead(v);
    // heading: a moving body takes the asked one; a standing one yaws toward it at TURN.rate and re-plants (below)
    const herr = wrap(h - heading);
    heading = moving || !opts.turnInPlace ? h : heading + Math.max(-TURN.rate * dt, Math.min(TURN.rate * dt, herr));
    row = force ?? selectRow(v, row); plan = boundPlan(gait, v, reach, row);
    // run 4: the slack is taken against the full chord (the reachable interval inside the joint clamps, held over the stance's
    // pitch swing), not CHORD_USE x it: the end of the sweep touches the reach edge only at the hind touchdown / fore lift-off.
    // With CHORD_USE the slow half-bound's hind prints fell 10.3 cm ahead, under one 12 cm print
    hindSlack = Math.max(0, (reach.hind.chord - plan.duty * plan.stride) / 2);
    foreSlack = Math.max(0, (reach.fore.chord - plan.foreDuty * plan.stride) / 2);
    stepCpg(cpg, plan.offsets, moving ? plan.hz : 0, dt, moving ? 1 : 0);
    const ph = phases(cpg); stridePhase = frac(ph[0] - plan.offsets[0]);
    const fwd = { x: -Math.sin(heading), z: -Math.cos(heading) }; // -z is forward in the body frame
    x += fwd.x * speed * dt; z += fwd.z * speed * dt;
    // pose request: only when stood still
    const want = !moving && request ? request : { kind: 'stand' as PoseKind, weight: 1 }, shape = POSE_SHAPES[want.kind], w = Math.min(want.weight ?? 1, poseReach(sk, want.kind));
    lastPose = want.kind;
    const pitchPose = springTo(pitchS, shape.pitch * w, .15, dt), drop = springTo(dropS, shape.drop * w, .15, dt);
    const foreUp = springTo(liftS, shape.foreLift ? w : 0, .12, dt); run = springTo(moveS, moving ? 1 : 0, .1, dt);
    foreAhead = moving ? 0 : shape.ahead ?? 0;
    // run 9: pose re-plant (bodies without turnInPlace too): a planted fore foot further than TURN.replant from where the pose
    // stands it steps there in TURN.step, one fore at a time (the other fore and both hinds stay down)
    if (!moving && !opts.turnInPlace && foreUp <= .02) for (const i of [0, 2]) {
      const f = feet[i], o = feet[2 - i]; if (!f.planted || !o.planted || turnStep[2 - i]) continue;
      const r0 = restWorld(i); if (Math.hypot(f.at.x - r0.x, f.at.z - r0.z) > TURN.replant) { forceStep(f); turnStep[i] = true; break; }
    }
    // turning / settling in place: re-plant the planted foot furthest from where it should stand, one per pair at a time
    let turning = !!opts.turnInPlace && !moving && Math.abs(wrap(h - heading)) > 1e-3;
    if (!moving && opts.turnInPlace) {
      let pick = -1, worst = TURN.replant;
      for (let i = 0; i < 4; i++) {
        const f = feet[i]; if (!f.planted || (FRONT(i) && foreUp > .02) || !feet[(i + 2) % 4].planted) continue;
        const r0 = restWorld(i), e = Math.hypot(f.at.x - r0.x, f.at.z - r0.z); if (e > worst) { worst = e; pick = i; }
      }
      if (pick >= 0 && feet.filter(f => !f.planted).length < 2) { forceStep(feet[pick]); turnStep[pick] = true; turnSteps++; turning = true; }
      if (turnStep.some((t, i) => t && !feet[i].planted)) turning = true;
    } else if (moving) turnStep.fill(false);
    // reach targets (spine, girdles, vault pitch), fore from the fore chord and hind from the hind chord
    const gs = girdleShifts(plan.canid, ph, reach, plan.spineUse, plan.foreDuty), shift = gs.shift.map(v2 => v2 * run), spineFlex = gs.spineFlex * run;
    // derived body pitch (pitchCurve), about the mid-trunk (the hip drops trunk/2·sin when the nose comes up); reachTargets'
    // vault pitch stays unused: its lever is the standing hip height, below this crouched body's leg reach
    const swing = moving ? pitchAt(pitchCurve(plan, sk), stridePhase) * run : 0;
    // the gait's joint ranges (BodyPlan.limits: stance measurements) phase in with motion; standing keeps the default
    const lim = blendLimits(CANID_LIMITS, gaitLimits, run);
    // v5: the body's height from the stride's ground forces (heightCurve: g·t²/8 flights + the stance dip), not flights only
    const lift = moving ? pitchAt(heightCurve(plan), stridePhase) * run : 0;
    const hipY = ground(x, z), shoY = ground(...(() => { const w2 = toWorld(x, z, heading, 0, sk.plan.shoulderZ - sk.plan.hipZ); return [w2.x, w2.z] as const; })());
    const rt = runTilt(sk, reach.rise, run, swing, pose), bodyPitch = rt.pitch + pitchPose; // relative to the ground
    const pitch = Math.atan2(shoY - hipY, sk.trunk) + bodyPitch, Hh = H.hip;
    const tilt: Tilt = { height: hipY + lift - drop + rt.height, pitch, roll: 0, shift: { y: Hh * (1 - Math.cos(pitch)), z: -Hh * Math.sin(pitch) } };
    const out: BoundFrame = { plan, stride: stridePhase, phases: ph, limbs: [], tops: [], feet: [], soles: [], mtp: [], contact: [], touchdowns: [], slip: [], x, z, heading, tilt, spineFlex, lift, pose: lastPose, leashes, turning, turnSteps };
    for (let i = 0; i < 4; i++) {
      const L = limbOf(i), front = FRONT(i), f = feet[i];
      if (front && foreUp > .02) { forceStep(f); f.settle = 0; }
      // v7: the fore landing point moves `foreTouch` forward late in the swing only (the mid-swing cells keep their path); only a
      // fore limb with a scapula (L.girdle) - the folding stance this fixes; a plan without one (host) lands extended already
      if (front && L.girdle) { const sp = ph[i] >= plan.duties[i] ? (ph[i] - plan.duties[i]) / (1 - plan.duties[i]) : 0, k = Math.max(0, Math.min(1, (sp - FORE_TOUCH.swingFrom) / (FORE_TOUCH.swingTo - FORE_TOUCH.swingFrom))); touchW[i] = moving && !f.planted ? k * k * (3 - 2 * k) : f.planted ? touchW[i] : 0; }
      const r = stepFoot(f, { phase: ph[i], duty: plan.duties[i], cycle: plan.stride, lift: (moving ? (front ? SWING.fold.fore : SWING.fold.hind) : .25) * L.hip, moving, reverse: speed < 0, dt, speed: v, rest: restWorld(i), fwd, settle: turnStep[i] ? TURN.step : undefined }, ground);
      if (turnStep[i] && f.planted) turnStep[i] = false;
      // v5: in flight a swinging foot rides with the ballistic body (heightCurve) rather than reaching back to the ground
      let target = !f.planted && moving && lift > 0 ? { ...r.at, y: r.at.y + lift * r.lift } : r.at;
      if (front && foreUp > .02) { // sit-up: the fore paws come up under the chest; run 8: .35 x hip (was .45, which held the paws 25 mm ABOVE the shoulder joint -
        // bound-checks v3 / posePlausibility; the reference sit-ups hang the paws in front of the chest, below the shoulder)
        const tuck = limbToWorld({ x: 0, y: .35 * L.hip, z: centre(i) - .02 }, x, z, heading, tilt, sk.hips[i]);
        target = { x: lerp(r.at.x, tuck.x, foreUp), y: lerp(r.at.y, tuck.y, foreUp), z: lerp(r.at.z, tuck.z, foreUp) }; f.at = { ...target };
      }
      // split hind foot: the IK reaches the MTP joint, the toes lying flat ahead of it to the toe tip (ik.ts toeTarget)
      const ik = toeTarget(target, fwd, toeOff(i), f.planted ? ground : undefined);
      let rel = worldToLimb(ik, x, z, heading, tilt, sk.hips[i]);
      // the girdle shifts carry the pivot along the ground (as dutyFits counts them), not along a pitched trunk
      const top = { z: shift[i] * Math.cos(bodyPitch), y: topY(L) + shift[i] * Math.sin(bodyPitch) };
      // v6: late-swing fore reach (FORE_REACH): keep the swing's height, reach no further than the limb does; not in a leash /
      // stop step or a sit-up
      if (front && L.girdle && moving && !f.planted && !f.forced && foreUp <= .02 && ph[i] >= plan.duties[i]) {
        const w = foreReachWeight((ph[i] - plan.duties[i]) / (1 - plan.duties[i])) * run;
        if (w > 0) { const t2 = foreReachTarget(L, top, rel, girdle, foreTouch > 0 ? { ...FORE_REACH, reach: FORE_REACH.reach - FORE_TOUCH.reachCut * foreTouch / FORE_TOUCH.ahead } : FORE_REACH); rel = { ...rel, z: rel.z + w * (t2.z - rel.z) }; }
      }
      const solve = (r0: Vec3) => {
        let psi = 0, blade: number | undefined, arm: number | undefined;
        if (!front) psi = hindFoot(L, top, r0, ankle0, prevPsi[i], lim, f.planted && moving ? bodyPitch : undefined).psi; // the reaching foot angle nearest the standing ankle
        else if (L.girdle) { const fl = foreLimb(L, top, r0, lim, prevFore[i], f.planted ? (moving && lockOn && FORE_LOCK.on && FORE_LOCK.hold && wasDown[i] ? stancePsi(lockPsi[i], ph[i] / plan.duties[i]) : undefined) : preSwingPsi((L.footAngle ?? 0) - (L.footFlex ?? 0) * r.lift, plantPsi[i], ph[i] >= plan.duties[i] ? (ph[i] - plan.duties[i]) / (1 - plan.duties[i]) : 0, moving), false, girdle, f.planted && moving && !wasDown[i] ? FORE_CONT.plant : FORE_CONT.carry, moving && lockOn && FORE_LOCK.on && (f.planted ? (wasDown[i] || (FORE_LOCK.plant && plantPsi[i] !== undefined)) : FORE_LOCK.swing) ? { psi: Math.min(FORE_LOCK.maxStep, (f.planted ? FORE_LOCK.stanceShare * FORE_LOCK.sweep * plan.hz / Math.max(plan.duties[i], .05) : FORE_LOCK.psiRate) * dt), blade: FORE_LOCK.bladeRate * dt, soft: f.planted ? FORE_LOCK.stanceSoft : FORE_LOCK.soft, w: f.planted ? FORE_LOCK.holdWeight : 1 } : undefined); psi = fl.psi; blade = fl.blade; arm = fl.arm; }
        const Lp = { ...L, footAngle: psi };
        const a = clampLimb(solveLimb(Lp, !front, r0, front && !L.girdle && !f.planted ? r.lift : 0, { top, fit: front && !L.girdle, blade }), front, lim);
        const s = soleOf(Lp, a), want0 = top.y - Math.hypot(top.y - r0.y, r0.x);
        const w = limbToWorld({ x: r0.x, y: s.y + (r0.y - want0), z: s.z }, x, z, heading, tilt, sk.hips[i]);
        return { psi, blade, arm, a, err: Math.hypot(s.z - r0.z, s.y - want0), w };
      };
      let sol = solve(rel);
      // a swinging foot the limb cannot reach must not end up under the ground: raise its target until the sole clears
      for (let k = 0; k < 4 && !f.planted && sol.w.y < ground(sol.w.x, sol.w.z) - 1e-4; k++) { rel = { ...rel, y: rel.y + (ground(sol.w.x, sol.w.z) - sol.w.y) + .002 }; sol = solve(rel); }
      if (!front) prevPsi[i] = sol.psi; else if (sol.blade !== undefined) { prevFore[i] = { blade: sol.blade, psi: sol.psi, arm: sol.arm }; if (f.planted && !wasDown[i]) { lockPsi[i] = sol.psi; if (moving && lockOn && FORE_LOCK.on && L.girdle) plantPsi[i] = foreLimb(L, top, rel, lim, prevFore[i], undefined, false, girdle, FORE_CONT.plant).psi; } }
      const a = sol.a, err = sol.err, mtpW = sol.w, soleW = { x: mtpW.x + target.x - ik.x, y: mtpW.y + target.y - ik.y, z: mtpW.z + target.z - ik.z };
      if (f.planted && moving && err > BOUND_LEASH) { forceStep(f); leashes++; out.leashes = leashes; }
      const down = f.planted;
      if (down && !wasDown[i]) out.touchdowns.push({ leg: i, at: { ...f.at } });
      wasDown[i] = down;
      out.limbs.push(a); out.tops.push(top); out.feet.push(target); out.soles.push(soleW); out.mtp.push(mtpW); out.contact.push(down);
      out.slip.push(down ? Math.hypot(soleW.x - f.at.x, soleW.y - f.at.y, soleW.z - f.at.z) : 0);
    }
    return out;
  } };
}
