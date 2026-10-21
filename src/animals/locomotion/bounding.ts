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
import { boundCadence, boundDuty, type BoundGait } from '../../core/agent/bound';
import type { Pose as AgentPose, Action as AgentAction } from '../../core/agent/pipeline';
import { reachTargets, suspensions, suspensionRise, type CanidPlan, type ReachBody, type Suspension } from '../../core/gaitData';
import type { LimbDims } from '../../core/animalBehavior';
import { createCpg, stepCpg, phases, type Cpg } from './cpg';
import { footState, forceStep, stepFoot, toWorld, type FootState } from './foot';
import { solveLimb, clampLimb, soleOf, type LimbAngles } from './ik';
import { worldToLimb, limbToWorld } from './controller';
import { springTo, spring, type Spring } from './spring';
import type { Tilt } from './balance';
import type { Skeleton } from './bodyPlan';
import type { TerrainFn, Vec3 } from './signals';

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
/** Speeds (m/s) between the rows, with hysteresis: [estimate] — Bertram & Gutmann keep the (flexed-back) half-bound at speed,
 * Bramble's jackrabbits gallop; no measured switch speed was found. ?row= in the lab forces one. */
export const ROW_SWITCH = { up: 7, down: 6.5 };
export const selectRow = (speed: number, prev: BoundRowId = 'half-bound'): BoundRowId =>
  prev === 'half-bound' ? (speed > ROW_SWITCH.up ? 'gallop-lagomorph' : 'half-bound') : (speed < ROW_SWITCH.down ? 'half-bound' : 'gallop-lagomorph');

/* ---------------------------------------------------------------- hind foot angle */
/**
 * The hind foot does not hold one angle through stance: it lands near flat, rolls, and leaves toe-first behind the hip,
 * the ankle staying near its working angle while the proximal and distal segments move together (the pantograph-like
 * tri-segmented mammal limb: Fischer & Blickhan 2006, J Exp Zool 305A:935, doi:10.1002/jez.a.333). Rule: of the foot
 * angles that reach `sole` within the joint clamps, take the one whose ankle angle is nearest `ankle` (the standing one),
 * tie-broken toward `prev` (continuity). Returns psi (rad from vertical, + = hock behind the toes) and whether it reaches.
 */
export const FOOT_SCAN = { from: -.8, to: 1.55, step: .05 };
export function hindFoot(L: LimbDims, top: { z: number; y: number }, sole: Vec3, ankle: number, prev?: number) {
  let best = { psi: L.footAngle ?? 0, cost: Infinity, err: Infinity, ok: false };
  for (let psi = FOOT_SCAN.from; psi <= FOOT_SCAN.to + 1e-9; psi += FOOT_SCAN.step) {
    const LL = { ...L, footAngle: psi }, a = clampLimb(solveLimb(LL, true, sole, 0, { top }), false), s = soleOf(LL, a);
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
/** The longest interval of ground points (top at rest) the clamped limb reaches within 0.1 mm: a 2 mm scan, edges bisected. */
export function limbRange(L: LimbDims, forward: boolean, front: boolean, ankle?: number): LimbRange {
  const span = 1.2 * (L.upper + L.lower + (L.foot ?? 0)), step = .004, top = { z: 0, y: L.hip };
  const ok = (z: number) => { if (ankle !== undefined) return hindFoot(L, top, { x: 0, y: 0, z }, ankle).ok;
    const a = clampLimb(solveLimb(L, forward, { x: 0, y: 0, z }, 0, { top, fit: true }), front);
    const s = soleOf(L, a); return Math.hypot(s.z - z, s.y) < 1e-4; };
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
export interface Reach { fore: LimbRange; hind: LimbRange; body: { fore: ReachBody; hind: ReachBody }; girdle: GirdleLimits }
export function reachOf(sk: Skeleton, girdle: GirdleLimits = GIRDLE): Reach {
  const H = sk.legs.hind, fore = limbRange(sk.legs, false, true), hind = limbRange(H, true, false, restAnkle(sk));
  const foreLever = H.hip, hindLever = H.hip; // scapular pivot at hip height (Fischer et al. 2002)
  const body = (chord: number): ReachBody => ({ legChord: { walk: chord, trot: chord, gallop: chord }, trunk: sk.trunk, foreLever, hindLever, scapulaMax: girdle.scapulaMax });
  return { fore, hind, body: { fore: body(CHORD_USE * fore.chord), hind: body(CHORD_USE * hind.chord) }, girdle };
}
/** Top-pivot shifts (m, +back) the girdles really give at one set of leg phases: the fore pivots as far as the capped shoulder
 * blade carries them (reachTargets' glide is not used), both hind pivots by the one pelvis (mean shift, capped at spineMax). */
export function girdleShifts(plan: CanidPlan, legPhases: readonly number[], reach: Reach, spineUse = 0) {
  const at: CanidPlan = { ...plan, offsets: legPhases }, tf = reachTargets(at, 0, reach.body.fore), hb = reach.body.hind;
  // the back takes spineUse of the hind sweep (up to its range) even where the limb could do it alone (Bramble 1989:
  // the flexing back is part of the stride), so the hind limb's chord in reachTargets shrinks by that much
  const sweep = plan.duty * plan.stride, byBack = spineUse * Math.min(sweep, 2 * reach.girdle.spineMax * hb.hindLever);
  const chord = Math.max(0, Math.min(hb.legChord.gallop, sweep - byBack)), th = reachTargets(at, 0, { ...hb, legChord: { walk: chord, trot: chord, gallop: chord } });
  const cap = reach.girdle.spineMax, spineFlex = Math.max(-cap, Math.min(cap, th.spineFlex)), hind = -spineFlex * reach.body.hind.hindLever;
  return { shift: [tf.girdle[0] - tf.glide[0], hind, tf.girdle[2] - tf.glide[1], hind], spineFlex, pitch: (tf.pitch + th.pitch) / 2 };
}
/** Does `duty` fit: every stance foot stays within CHORD_USE × its chord of its (shifted) pivot over the whole stride? */
function dutyFits(base: Omit<CanidPlan, 'duty' | 'suspensions'>, duty: number, reach: Reach, spineUse: number, n = 240) {
  const plan: CanidPlan = { ...base, duty, suspensions: [] }, sweep = duty * plan.stride;
  for (let k = 0; k < n; k++) {
    const ph = plan.offsets.map(o => frac(k / n + o)), g = girdleShifts(plan, ph, reach, spineUse);
    for (let i = 0; i < 4; i++) if (ph[i] < duty) {
      // fore: the planned chord; hind: the full chord — the margin takes the shared pelvis' residual (gaitData hindResidual)
      const chord = FRONT(i) ? reach.body.fore.legChord.gallop : reach.hind.chord;
      if (Math.abs(sweep * (ph[i] / duty - .5) - g.shift[i]) > chord / 2 + 1e-6) return false;
    }
  }
  return true;
}

/* ---------------------------------------------------------------- plan */
export interface BoundPlan {
  row: BoundRowId; speed: number; hz: number; stride: number;
  /** duty the data asks for, and the one used: the largest ≤ data that the limbs + girdles can sweep (dutyFits) */ dutyData: number; duty: number;
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
  const v = Math.max(.05, Math.abs(speed)), hz = boundCadence(g, v), stride = v / hz, dutyData = boundDuty(g, v), offsets = rowOffsets(boundRows(g)[row]);
  const base = { gait: 'gallop' as const, froude: 0, hz, stride, offsets }, use = spineUse(g, v);
  // the fitted duty, cached per 1 cm/s (bisection over a sampled stride is too slow per frame)
  const key = `${row}|${Math.round(v * 100)}|${reach.fore.chord}|${reach.hind.chord}|${JSON.stringify(g)}`;
  let duty = planCache.get(key);
  if (duty === undefined) {
    if (dutyFits(base, dutyData, reach, use)) duty = dutyData;
    else { let lo = .01, hi = dutyData; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (dutyFits(base, m, reach, use)) lo = m; else hi = m; } duty = lo; }
    if (planCache.size > 5000) planCache.clear(); planCache.set(key, duty);
  }
  const sus = suspensions(offsets, duty);
  return { row, speed: v, hz, stride, dutyData, duty, offsets, suspensions: sus, spineUse: use, canid: { ...base, duty, suspensions: sus } };
}

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
export interface BoundController { update(dt: number, speed: number, heading: number, request?: PoseRequest | null, row?: BoundRowId): BoundFrame; readonly reach: Reach; readonly skeleton: Skeleton }
/** Leash: a planted foot the clamped limb cannot reach by this much steps (counted; the score fails any). */
export const BOUND_LEASH = .01;

export function createBounding(sk: Skeleton, gait: BoundGait, ground: TerrainFn, start: { x: number; z: number; heading: number }, girdle: GirdleLimits = GIRDLE): BoundController {
  const reach = reachOf(sk, girdle), H = sk.legs.hind;
  const limbOf = (i: number) => FRONT(i) ? sk.legs as LimbDims : H;
  // where a foot rests: standing (fore under the shoulder, hind toes `stance` ahead) → the centre of its running chord
  let run = 0; const centre = (i: number) => FRONT(i) ? lerp(0, reach.fore.centre, run) : lerp(-(H.stance ?? 0), reach.hind.centre, run);
  let x = start.x, z = start.z, heading = start.heading, row: BoundRowId = 'half-bound', leashes = 0, stridePhase = 0;
  const restWorld = (i: number, px = x, pz = z, h = heading) => { const w = toWorld(px, pz, h, sk.hips[i][0], sk.hips[i][1] + centre(i)); return { x: w.x, y: ground(w.x, w.z), z: w.z }; };
  const feet: FootState[] = [0, 1, 2, 3].map(i => footState(restWorld(i)));
  let plan = boundPlan(gait, .05, reach, row); const cpg: Cpg = createCpg(plan.offsets);
  const pitchS: Spring = spring(0), dropS: Spring = spring(0), liftS: Spring = spring(0), moveS: Spring = spring(0);
  let wasDown = feet.map(() => true), lastPose: PoseKind = 'stand'; const ankle0 = restAnkle(sk), prevPsi: (number | undefined)[] = [undefined, sk.restFootAngle, undefined, sk.restFootAngle];
  return { reach, skeleton: sk, update(dt, speed, h, request, force) {
    heading = h; const v = Math.abs(speed), moving = v > .05;
    row = force ?? selectRow(v, row); plan = boundPlan(gait, v, reach, row);
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
    const gs = girdleShifts(plan.canid, ph, reach, plan.spineUse), shift = gs.shift.map(v2 => v2 * run), spineFlex = gs.spineFlex * run, vault = 0; // no vault pitch: the chords are measured with the pivots at rest height
    // ballistic lift over a suspension (g·T²/8 arc) — gaitData suspensionRise
    let lift = 0;
    for (const s of plan.suspensions) { const p = frac(stridePhase - s.from), len = s.to - s.from; if (p < len) lift = Math.max(lift, 4 * suspensionRise(len, plan.hz) * (p / len) * (1 - p / len)); }
    lift *= run;
    const hipY = ground(x, z), shoY = ground(...(() => { const w2 = toWorld(x, z, heading, 0, sk.plan.shoulderZ - sk.plan.hipZ); return [w2.x, w2.z] as const; })());
    const pitch = Math.atan2(shoY - hipY, sk.trunk) + vault + pitchPose, Hh = H.hip;
    const tilt: Tilt = { height: hipY + lift - drop, pitch, roll: 0, shift: { y: Hh * (1 - Math.cos(pitch)), z: -Hh * Math.sin(pitch) } };
    const out: BoundFrame = { plan, stride: stridePhase, phases: ph, limbs: [], tops: [], feet: [], soles: [], contact: [], touchdowns: [], slip: [], x, z, heading, tilt, spineFlex, lift, pose: lastPose, leashes };
    for (let i = 0; i < 4; i++) {
      const L = limbOf(i), front = FRONT(i), f = feet[i];
      if (front && foreUp > .02) { forceStep(f); f.settle = 0; }
      const r = stepFoot(f, { phase: ph[i], duty: plan.duty, cycle: plan.stride, lift: .25 * L.hip, moving, reverse: speed < 0, dt, speed: v, rest: restWorld(i), fwd }, ground);
      let target = r.at;
      if (front && foreUp > .02) { // sit-up: the fore paws come up under the chest
        const tuck = limbToWorld({ x: 0, y: .45 * L.hip, z: centre(i) - .02 }, x, z, heading, tilt, sk.hips[i]);
        target = { x: lerp(r.at.x, tuck.x, foreUp), y: lerp(r.at.y, tuck.y, foreUp), z: lerp(r.at.z, tuck.z, foreUp) }; f.at = { ...target };
      }
      let rel = worldToLimb(target, x, z, heading, tilt, sk.hips[i]);
      const top = { z: shift[i], y: L.hip };
      const solve = (r0: Vec3) => {
        // hind foot: the reaching foot angle nearest the standing ankle (hindFoot)
        const psi = front ? 0 : hindFoot(L, top, r0, ankle0, prevPsi[i]).psi, Lp = { ...L, footAngle: psi };
        const a = clampLimb(solveLimb(Lp, !front, r0, front && !f.planted ? r.lift : 0, { top, fit: front }), front);
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
