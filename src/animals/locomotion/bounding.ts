/**
 * Bounding controller (grok-gait, T-0009): half-bound and lagomorph-gallop footfalls on a limb skeleton from bodyPlan.ts.
 * Data-driven: the footfall timing, duty and cadence come in as a core/agent/bound BoundGait (the species data the agent
 * pipeline already carries; its pure functions are reused, not copied), the limbs as a Skeleton. Nothing names a species.
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
import { boundCadence, boundDuty, boundForeDuty, type BoundGait } from '../../core/agent/bound';
import type { Pose as AgentPose, Action as AgentAction } from '../../core/agent/pipeline';
import { reachTargets, suspensions, suspensionRise, type CanidPlan, type ReachBody, type Suspension } from '../../core/gaitData';
import type { LimbDims } from '../../core/animalBehavior';
import { createCpg, stepCpg, phases, type Cpg } from './cpg';
import { footState, forceStep, stepFoot, toWorld, type FootState } from './foot';
import { solveLimb, clampLimb, soleOf, blendLimits, CANID_LIMITS, type JointLimits, type LimbAngles } from './ik';
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
 * given, only foot angles inside it are tried: the foot-to-ground angle is 90° − (psi − pitch).
 */
export const FOOT_SCAN = { from: -.8, to: 1.55, step: .05 };
export function hindFoot(L: LimbDims, top: { z: number; y: number }, sole: Vec3, ankle: number, prev?: number, limits: JointLimits = CANID_LIMITS, pitch?: number) {
  let best = { psi: L.footAngle ?? 0, cost: Infinity, err: Infinity, ok: false };
  const fr = limits.hind.foot, D = Math.PI / 180, lo = fr && pitch !== undefined ? pitch + (90 - fr.max) * D : -Infinity, hi = fr && pitch !== undefined ? pitch + (90 - fr.min) * D : Infinity;
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

/* ---------------------------------------------------------------- reach (what the limbs can sweep) */
export interface LimbRange { /** reachable sole interval at ground level, top at rest (m, +back) */ from: number; to: number; chord: number; centre: number }
/** The longest interval of ground points the clamped limb reaches within 0.1 mm: a 4 mm scan, edges bisected. Without
 * `body` the top is at rest over level ground; with it, ground point z (m, +back of the limb's hip) is seen from the limb
 * frame of a body standing in tilt `body.tilt` (bodies that run taller and pitched: runPose), and the foot range is taken
 * relative to the ground. */
export function limbRange(L: LimbDims, forward: boolean, front: boolean, ankle?: number, limits: JointLimits = CANID_LIMITS, body?: { tilt: Tilt; hip: readonly [number, number] }): LimbRange {
  const span = 1.2 * (L.upper + L.lower + (L.foot ?? 0)), step = .004, top = { z: 0, y: L.hip };
  const at = (z: number): Vec3 => body ? worldToLimb({ x: body.hip[0], y: 0, z: body.hip[1] + z }, 0, 0, 0, body.tilt, body.hip) : { x: 0, y: 0, z };
  const ok = (z: number) => { const rel = at(z);
    if (ankle !== undefined) return hindFoot(L, top, rel, ankle, undefined, limits, body?.tilt.pitch ?? 0).ok;
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
 * 205:1315, doi:10.1242/jeb.205.9.1315); pelvis touchdown 100-111°, lift-off 131-151° (~35° of stance, ±0.30 rad), the
 * lumbar spine giving about half the hind step length in bounds (Schilling & Hackert 2006; Fischer et al. 2002). The
 * scapular pivot sits at hip height (Fischer et al. 2002), so both levers are the hip height.
 */
export const GIRDLE: GirdleLimits = { scapulaMax: .3, spineMax: .3 };
/** Share of each limb chord a planted foot may use (the clamp sits right at the reach edge) — game calibration. */
export const CHORD_USE = .9;
/**
 * Running posture — DERIVED: how far the hips rise above their standing height while running (`rise`, m), the shoulders
 * staying at theirs (the body pitches nose-down about the hips by asin(rise / trunk)). A crouched sitter (hare: hip .13 m on
 * a .33 m leg + foot) cannot sweep its hind foot through stance inside the gait's measured ankle range (LEPORID_LIMITS: no
 * foot under the hip below ~.20 m with the dog knee), so the rise is the one, of 0..RUN_POSE.maxRise in 5 mm steps, with the
 * longest fore + hind chords. With the dog ranges (wolf and others) the standing height already sweeps and rise stays small.
 */
export const RUN_POSE = { maxRise: .12, step: .005 };
/** Tilt of a body risen `rise`·t at the hips (shoulders kept), plus the bound's pitch swing `swing` about the mid-trunk. */
export const runTilt = (sk: Skeleton, rise: number, t = 1, swing = 0): Tilt => { const p = -Math.asin(Math.min(.95, rise * t / sk.trunk)) + swing, Hh = sk.legs.hind.hip;
  return { height: rise * t - sk.trunk / 2 * Math.sin(swing), pitch: p, roll: 0, shift: { y: Hh * (1 - Math.cos(p)), z: -Hh * Math.sin(p) } }; };
export interface Reach { fore: LimbRange; hind: LimbRange; body: { fore: ReachBody; hind: ReachBody }; girdle: GirdleLimits; /** running hip rise (m, RUN_POSE) */ rise: number }
const reachCache = new WeakMap<Skeleton, Map<string, Reach>>();
export function reachOf(sk: Skeleton, girdle: GirdleLimits = GIRDLE): Reach {
  const key = JSON.stringify(girdle); let m = reachCache.get(sk); if (!m) reachCache.set(sk, m = new Map()); const hit = m.get(key); if (hit) return hit;
  // the running reach: the body's gait joint ranges (BodyPlan.limits) at the running posture (RUN_POSE), relative to the ground
  const H = sk.legs.hind, lim = sk.plan.limits ?? CANID_LIMITS, ankle = restAnkle(sk);
  // each chord holds over the whole pitch swing (BOUND_PITCH.max each way): the interval common to the three tilts
  const meet = (rs: LimbRange[]): LimbRange => { const from = Math.max(...rs.map(r => r.from)), to = Math.min(...rs.map(r => r.to)), chord = Math.max(0, to - from);
    return chord > 0 ? { from, to, chord, centre: (from + to) / 2 } : { from: 0, to: 0, chord: 0, centre: 0 }; };
  const ranges = (rise: number) => { const tilts = [0, -BOUND_PITCH.max, BOUND_PITCH.max].map(w => runTilt(sk, rise, 1, w));
    return { fore: meet(tilts.map(tilt => limbRange(sk.legs, false, true, undefined, lim, { tilt, hip: sk.hips[0] }))),
      hind: meet(tilts.map(tilt => limbRange(H, true, false, ankle, lim, { tilt, hip: sk.hips[1] }))) }; };
  let best = { rise: 0, ...ranges(0) };
  for (let r = RUN_POSE.step; r <= RUN_POSE.maxRise + 1e-9; r += RUN_POSE.step) { const c = ranges(r); if (c.fore.chord + c.hind.chord > best.fore.chord + best.hind.chord + 1e-3) best = { rise: r, ...c }; }
  const { fore, hind, rise } = best;
  const foreLever = H.hip, hindLever = H.hip; // scapular pivot at hip height (Fischer et al. 2002)
  const body = (chord: number): ReachBody => ({ legChord: { walk: chord, trot: chord, gallop: chord }, trunk: sk.trunk, foreLever, hindLever, scapulaMax: girdle.scapulaMax });
  const out: Reach = { fore, hind, body: { fore: body(CHORD_USE * fore.chord), hind: body(CHORD_USE * hind.chord) }, girdle, rise };
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
  return { shift: [tf.girdle[0] - tf.glide[0], hind, tf.girdle[2] - tf.glide[1], hind], spineFlex, pitch: (tf.pitch + th.pitch) / 2 };
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
  /** the same for the fore feet (BoundGait foreShare x hind), scaled with the hind when the limbs cannot sweep it */ foreDutyData: number; foreDuty: number;
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
const planCache = new Map<string, number>();
export function boundPlan(g: BoundGait, speed: number, reach: Reach, row: BoundRowId): BoundPlan {
  const v = Math.max(.05, Math.abs(speed)), hz = boundCadence(g, v), stride = v / hz, dutyData = boundDuty(g, v), foreDutyData = boundForeDuty(g, v), offsets = rowOffsets(boundRows(g)[row]);
  const base = { gait: 'gallop' as const, froude: 0, hz, stride, offsets }, use = spineUse(g, v);
  // the fitted share of the data duties (fore and hind scaled together), cached per 1 cm/s (bisection over a sampled stride
  // is too slow per frame)
  const key = `${row}|${Math.round(v * 100)}|${reach.fore.chord}|${reach.hind.chord}|${JSON.stringify(g)}`;
  let share = planCache.get(key);
  if (share === undefined) {
    if (dutyFits(base, dutyData, foreDutyData, reach, use)) share = 1;
    else { let lo = .01, hi = 1; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (dutyFits(base, m * dutyData, m * foreDutyData, reach, use)) lo = m; else hi = m; } share = lo; }
    if (planCache.size > 5000) planCache.clear(); planCache.set(key, share);
  }
  const duty = share * dutyData, foreDuty = share * foreDutyData, duties = [foreDuty, duty, foreDuty, duty], dutiesData = [foreDutyData, dutyData, foreDutyData, dutyData];
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

/* ---------------------------------------------------------------- pose requests (agent pipeline → body) */
export type PoseKind = 'stand' | 'graze-crouch' | 'sit-up' | 'scan' | 'rest' | 'crouch';
/** What the agent pipeline may ask of a standing body. `weight` 0..1 blends from 'stand' (default 1). */
export interface PoseRequest { kind: PoseKind; weight?: number }
/** Body shape per request: pitch (rad, + front up, about the hip), drop (m, hip lowered), fore lifted off the ground. */
export interface PoseShape { pitch: number; drop: number; foreLift: boolean }
/** Values from the host's hare.ts POSES (grok, [estimate] there: drawn to photos); 'stand' is the rest skeleton. */
export const POSE_SHAPES: Record<PoseKind, PoseShape> = {
  stand: { pitch: 0, drop: 0, foreLift: false },
  'graze-crouch': { pitch: -.1, drop: .02, foreLift: false },
  'sit-up': { pitch: .95, drop: 0, foreLift: true },
  scan: { pitch: .3, drop: 0, foreLift: false },
  rest: { pitch: -.04, drop: .035, foreLift: false },
  crouch: { pitch: -.06, drop: .045, foreLift: false },
};
/** Adapter from the agent pipeline's Pose (and action, to tell an alert sit-up from a scan). Moving poses ask for nothing. */
export function poseRequestFor(pose: AgentPose, action?: AgentAction): PoseRequest | null {
  switch (pose) {
    case 'head-down': return { kind: 'graze-crouch' };
    case 'head-up': return { kind: action === 'scan' ? 'scan' : 'sit-up' };
    case 'rest': return { kind: 'rest' };
    case 'crouch': return { kind: 'crouch' };
    default: return null;
  }
}

/** Worst sole error (m) of the planted feet of a standing body at pitch `pitch` (about the hip) and hip drop `drop`. */
export function standError(sk: Skeleton, pitch: number, drop: number, foreLift: boolean) {
  const H = sk.legs.hind, tilt: Tilt = { height: -drop, pitch, roll: 0, shift: { y: H.hip * (1 - Math.cos(pitch)), z: -H.hip * Math.sin(pitch) } }, ankle = restAnkle(sk);
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const front = FRONT(i); if (front && foreLift) continue;
    const L = front ? sk.legs as LimbDims : H, foot = { x: sk.hips[i][0], y: 0, z: sk.hips[i][1] + (front ? 0 : -(H.stance ?? 0)) };
    const rel = worldToLimb(foot, 0, 0, 0, tilt, sk.hips[i]), top = { z: 0, y: L.hip };
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
  const sh = POSE_SHAPES[kind], err = (w: number) => standError(sk, sh.pitch * w, sh.drop * w, sh.foreLift);
  let w = 1; if (err(1) > POSE_REACH) { let lo = 0, hi = 1; for (let k = 0; k < 16; k++) { const c = (lo + hi) / 2; if (err(c) <= POSE_REACH) lo = c; else hi = c; } w = lo; }
  m.set(kind, w); return w;
}

/* ---------------------------------------------------------------- controller */
export interface BoundFrame {
  plan: BoundPlan; stride: number; phases: number[];
  /** clamped limb angles and the chain tops actually used (limb frame) */ limbs: LimbAngles[]; tops: { z: number; y: number }[];
  /** world target per foot and the world sole the clamped limb reaches */ feet: Vec3[]; soles: Vec3[];
  contact: boolean[]; touchdowns: { leg: number; at: Vec3 }[];
  /** per foot: |rendered sole − planted foot| (m), 0 in swing */ slip: number[];
  x: number; z: number; heading: number; tilt: Tilt; spineFlex: number; lift: number; pose: PoseKind; leashes: number;
}
export interface BoundController {
  update(dt: number, speed: number, heading: number, request?: PoseRequest | null, row?: BoundRowId): BoundFrame;
  /** put the body at (x, z, heading) with the feet at rest under it (a host that moves its animal itself, e.g. after a teleport) */
  place(x: number, z: number, heading: number): void;
  readonly reach: Reach; readonly skeleton: Skeleton;
}
/** World points of limb `i` in a frame: [chain top, girdle joint, knee/elbow, ankle/wrist, toe] (for drawing bones). */
export function limbPoints(sk: Skeleton, frame: BoundFrame, i: number): Vec3[] {
  const L: LimbDims = FRONT(i) ? sk.legs : sk.legs.hind, a = frame.limbs[i], dir = (u: number) => ({ z: -Math.sin(u), y: -Math.cos(u) });
  const a1 = a.girdle + a.leg, a2 = a1 + a.knee, a3 = a2 + a.wrist, j = a.joint, top = frame.tops[i];
  const k = { z: j.z + L.upper * dir(a1).z, y: j.y + L.upper * dir(a1).y }, w = { z: k.z + L.lower * dir(a2).z, y: k.y + L.lower * dir(a2).y };
  const f = { z: w.z + (L.foot ?? 0) * dir(a3).z, y: w.y + (L.foot ?? 0) * dir(a3).y };
  return [top, j, k, w, f].map(p => limbToWorld({ x: 0, y: p.y, z: p.z }, frame.x, frame.z, frame.heading, frame.tilt, sk.hips[i]));
}
/** Leash: a planted foot the clamped limb cannot reach by this much steps (counted; the score fails any). */
export const BOUND_LEASH = .01;

export function createBounding(sk: Skeleton, gait: BoundGait, ground: TerrainFn, start: { x: number; z: number; heading: number }, girdle: GirdleLimits = GIRDLE): BoundController {
  const reach = reachOf(sk, girdle), H = sk.legs.hind;
  const limbOf = (i: number) => FRONT(i) ? sk.legs as LimbDims : H;
  // where a foot rests: standing (fore under the shoulder, hind toes `stance` ahead) → the centre of its running chord
  // a hind sweep shorter than the chord sits at the chord's front end (the hind prints land ahead: Lagomorpha Locomotion 2021)
  let run = 0, hindSlack = 0; const centre = (i: number) => FRONT(i) ? lerp(0, reach.fore.centre, run) : lerp(-(H.stance ?? 0), reach.hind.centre - hindSlack, run);
  let x = start.x, z = start.z, heading = start.heading, row: BoundRowId = 'half-bound', leashes = 0, stridePhase = 0;
  const restWorld = (i: number, px = x, pz = z, h = heading) => { const w = toWorld(px, pz, h, sk.hips[i][0], sk.hips[i][1] + centre(i)); return { x: w.x, y: ground(w.x, w.z), z: w.z }; };
  const feet: FootState[] = [0, 1, 2, 3].map(i => footState(restWorld(i)));
  let plan = boundPlan(gait, .05, reach, row); const cpg: Cpg = createCpg(plan.offsets);
  const pitchS: Spring = spring(0), dropS: Spring = spring(0), liftS: Spring = spring(0), moveS: Spring = spring(0);
  const gaitLimits = sk.plan.limits ?? CANID_LIMITS;
  let wasDown = feet.map(() => true), lastPose: PoseKind = 'stand'; const ankle0 = restAnkle(sk), prevPsi: (number | undefined)[] = [undefined, sk.restFootAngle, undefined, sk.restFootAngle];
  return { reach, skeleton: sk, place(px, pz, h) { x = px; z = pz; heading = h; for (let i = 0; i < 4; i++) { const f0 = footState(restWorld(i)); Object.assign(feet[i], f0); wasDown[i] = true; } },
  update(dt, speed, h, request, force) {
    heading = h; const v = Math.abs(speed), moving = v > .05;
    row = force ?? selectRow(v, row); plan = boundPlan(gait, v, reach, row);
    hindSlack = Math.max(0, (CHORD_USE * reach.hind.chord - plan.duty * plan.stride) / 2);
    stepCpg(cpg, plan.offsets, moving ? plan.hz : 0, dt, moving ? 1 : 0);
    const ph = phases(cpg); stridePhase = frac(ph[0] - plan.offsets[0]);
    const fwd = { x: -Math.sin(heading), z: -Math.cos(heading) }; // -z is forward in the body frame
    x += fwd.x * speed * dt; z += fwd.z * speed * dt;
    // pose request: only when stood still
    const want = !moving && request ? request : { kind: 'stand' as PoseKind, weight: 1 }, shape = POSE_SHAPES[want.kind], w = Math.min(want.weight ?? 1, poseReach(sk, want.kind));
    lastPose = want.kind;
    const pitchPose = springTo(pitchS, shape.pitch * w, .15, dt), drop = springTo(dropS, shape.drop * w, .15, dt);
    const foreUp = springTo(liftS, shape.foreLift ? w : 0, .12, dt); run = springTo(moveS, moving ? 1 : 0, .1, dt);
    // reach targets (spine, girdles, vault pitch), fore from the fore chord and hind from the hind chord
    const gs = girdleShifts(plan.canid, ph, reach, plan.spineUse, plan.foreDuty), shift = gs.shift.map(v2 => v2 * run), spineFlex = gs.spineFlex * run;
    // derived body pitch (pitchCurve), about the mid-trunk (the hip drops trunk/2·sin when the nose comes up); reachTargets'
    // vault pitch stays unused: its lever is the standing hip height, below this crouched body's leg reach
    const swing = moving ? pitchAt(pitchCurve(plan, sk), stridePhase) * run : 0;
    // the gait's joint ranges (BodyPlan.limits: stance measurements) phase in with motion; standing keeps the default
    const lim = blendLimits(CANID_LIMITS, gaitLimits, run);
    // ballistic lift over a suspension (g·T²/8 arc) — gaitData suspensionRise
    let lift = 0;
    for (const s of plan.suspensions) { const p = frac(stridePhase - s.from), len = s.to - s.from; if (p < len) lift = Math.max(lift, 4 * suspensionRise(len, plan.hz) * (p / len) * (1 - p / len)); }
    lift *= run;
    const hipY = ground(x, z), shoY = ground(...(() => { const w2 = toWorld(x, z, heading, 0, sk.plan.shoulderZ - sk.plan.hipZ); return [w2.x, w2.z] as const; })());
    const rt = runTilt(sk, reach.rise, run, swing), bodyPitch = rt.pitch + pitchPose; // relative to the ground
    const pitch = Math.atan2(shoY - hipY, sk.trunk) + bodyPitch, Hh = H.hip;
    const tilt: Tilt = { height: hipY + lift - drop + rt.height, pitch, roll: 0, shift: { y: Hh * (1 - Math.cos(pitch)), z: -Hh * Math.sin(pitch) } };
    const out: BoundFrame = { plan, stride: stridePhase, phases: ph, limbs: [], tops: [], feet: [], soles: [], contact: [], touchdowns: [], slip: [], x, z, heading, tilt, spineFlex, lift, pose: lastPose, leashes };
    for (let i = 0; i < 4; i++) {
      const L = limbOf(i), front = FRONT(i), f = feet[i];
      if (front && foreUp > .02) { forceStep(f); f.settle = 0; }
      const r = stepFoot(f, { phase: ph[i], duty: plan.duties[i], cycle: plan.stride, lift: .25 * L.hip, moving, reverse: speed < 0, dt, speed: v, rest: restWorld(i), fwd }, ground);
      let target = r.at;
      if (front && foreUp > .02) { // sit-up: the fore paws come up under the chest
        const tuck = limbToWorld({ x: 0, y: .45 * L.hip, z: centre(i) - .02 }, x, z, heading, tilt, sk.hips[i]);
        target = { x: lerp(r.at.x, tuck.x, foreUp), y: lerp(r.at.y, tuck.y, foreUp), z: lerp(r.at.z, tuck.z, foreUp) }; f.at = { ...target };
      }
      let rel = worldToLimb(target, x, z, heading, tilt, sk.hips[i]);
      // the girdle shifts carry the pivot along the ground (as dutyFits counts them), not along a pitched trunk
      const top = { z: shift[i] * Math.cos(bodyPitch), y: L.hip + shift[i] * Math.sin(bodyPitch) };
      const solve = (r0: Vec3) => {
        // hind foot: the reaching foot angle nearest the standing ankle (hindFoot)
        const psi = front ? 0 : hindFoot(L, top, r0, ankle0, prevPsi[i], lim, f.planted && moving ? bodyPitch : undefined).psi, Lp = { ...L, footAngle: psi };
        const a = clampLimb(solveLimb(Lp, !front, r0, front && !f.planted ? r.lift : 0, { top, fit: front }), front, lim);
        const s = soleOf(Lp, a), want0 = top.y - Math.hypot(top.y - r0.y, r0.x);
        const w = limbToWorld({ x: r0.x, y: s.y + (r0.y - want0), z: s.z }, x, z, heading, tilt, sk.hips[i]);
        return { psi, a, err: Math.hypot(s.z - r0.z, s.y - want0), w };
      };
      let sol = solve(rel);
      // a swinging foot the limb cannot reach must not end up under the ground: raise its target until the sole clears
      for (let k = 0; k < 4 && !f.planted && sol.w.y < ground(sol.w.x, sol.w.z) - 1e-4; k++) { rel = { ...rel, y: rel.y + (ground(sol.w.x, sol.w.z) - sol.w.y) + .002 }; sol = solve(rel); }
      if (!front) prevPsi[i] = sol.psi;
      const a = sol.a, err = sol.err, soleW = sol.w;
      if (f.planted && moving && err > BOUND_LEASH) { forceStep(f); leashes++; out.leashes = leashes; }
      const down = f.planted;
      if (down && !wasDown[i]) out.touchdowns.push({ leg: i, at: { ...f.at } });
      wasDown[i] = down;
      out.limbs.push(a); out.tops.push(top); out.feet.push(target); out.soles.push(soleW); out.contact.push(down);
      out.slip.push(down ? Math.hypot(soleW.x - f.at.x, soleW.y - f.at.y, soleW.z - f.at.z) : 0);
    }
    return out;
  } };
}
