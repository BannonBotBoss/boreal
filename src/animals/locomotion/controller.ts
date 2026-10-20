/**
 * Locomotion controller: signals → CPG phases → feet (world-planted, terrain-sampled) → body tilt → limb IK → joint
 * springs. One instance per animal; all state is plain numbers (snapshot-friendly) and nothing is random.
 * LOD (PROJECT-RULES rule 8): 'near' = everything above; 'mid' = the same CPG phases driving the ideal flat
 * trajectory on the tilted body plane (2 ground samples, no foot locks, no springs). Far = no instance at all.
 * M2: planted legs snap to their IK solution (springs smooth only swing legs, so planted paws never trail), a gallop
 * body bounce (Claude's gallopBob on the LH phase), and the jump/pounce state machine (jump.ts) driven by `intent`.
 */
import { VAULT_MAX_DROP, VAULT_RELEASE, WOLF_GIRDLE_Z, WOLF_LEGS, WOLF_REACH, bendsForward, gallopBob, isFrontLeg, limbDrop, limbOf, pelvisShift, pitchShift, solveChain, stancePhase, suspensionBob, vaultDips, vaultPlan, type GaitName } from '../../core/animalBehavior';
import { reachTargets, type CanidPlan } from '../../core/gaitData';
import { LEG_XZ } from '../../core/wolfBody';
import { WOLF_SCALE } from '../../core/wolfModes';
import { createCpg, phases, stepCpg, type Cpg } from './cpg';
import { footState, forceStep, stepFoot, toWorld, type FootState } from './foot';
import { planGait, type GaitPlan } from './gaits';
import { clampLimb, soleOf, solveLimb, type LimbAngles, type LimbReach } from './ik';
import { supportPlane, type Tilt } from './balance';
import { spring, springTo, type Spring } from './spring';
import { LEG_NAMES, type LegLayout, type LegPose, type LocoSignals, type Lod, type TerrainFn, type Touchdown, type Vec3 } from './signals';
import { smooth01 } from '../../proc/math';
import { flightFoot, jumpFrame, type Jump, type JumpFrame } from './jump';
import { POSTURE, carryWeight } from './posture';

/** The reference test body: Claude's real-size gray-wolf legs (WOLF_LEGS) and limb positions (LEG_XZ × WOLF_SCALE). Read only. */
export const referenceLayout = (): LegLayout => ({ legs: WOLF_LEGS, hips: LEG_XZ.map(([x, z]) => [x * WOLF_SCALE, z * WOLF_SCALE] as const) });

/** Joint and body spring half-lives (s) at a 0.55 m hip, scaled by √(hip / 0.55) (dynamic similarity; game calibration). */
export const SPRINGS = { joint: .025, body: .08, refHip: .55 };
const KEYS = ['girdle', 'leg', 'knee', 'wrist', 'paw', 'abduct'] as const;
/**
 * Full-detail radius (m): within it an animal runs the 'near' path, beyond it 'mid' (game calibration). PROJECT-RULES
 * rule 10 wants every cost knob in core/quality.ts LADDER; quality.ts is Claude's file, so this should become a LADDER
 * column `loco` (proposed Ultra 40 … Minimum 6) when Claude folds it in (AGENT-NOTES.md).
 */
export const LOCO_LOD = { nearRadius: 30 };
export const lodAt = (distance: number): Lod => distance <= LOCO_LOD.nearRadius ? 'near' : 'mid';

export interface Locomotion {
  update(s: LocoSignals, dt: number, lod?: Lod): LegPose;
  /** called once per paw touchdown (also listed in LegPose.touchdowns); returns an unsubscribe function */
  onTouchdown(fn: (t: Touchdown) => void): () => void;
  readonly feet: FootState[]; readonly cpg: Cpg; plan(): GaitPlan; jumping(): boolean;
}

export function createLocomotion(layout: LegLayout, ground: TerrainFn, start: { x: number; z: number; heading: number }): Locomotion {
  const { legs, hips } = layout;
  // the fore wrist folds further through the swing (POSTURE.swingWristFlex); the sole target is unchanged, so contacts stay exact
  const limbs = [0, 1, 2, 3].map(i => { const L = limbOf(legs, i); return isFrontLeg(i) ? { ...L, footFlex: (L.footFlex ?? 0) + POSTURE.swingWristFlex, footAngle: (L.footAngle ?? 0) + POSTURE.foreFootAngle } : { ...L, footAngle: (L.footAngle ?? 0) + POSTURE.hindFootAngle }; });
  const restBody = (i: number) => [hips[i][0] * POSTURE.track, hips[i][1] - (limbs[i].stance ?? 0) - (isFrontLeg(i) ? 0 : POSTURE.hindReach * legs.hip)] as const;
  const restWorld = (x: number, z: number, h: number, i: number) => toWorld(x, z, h, ...restBody(i));
  const wheelbase = Math.abs((hips[1][1] + hips[3][1]) / 2 - (hips[0][1] + hips[2][1]) / 2);
  const track = Math.abs((hips[2][0] + hips[3][0]) / 2 - (hips[0][0] + hips[1][0]) / 2);
  let plan = planGait(0, legs, 'walk');
  const cpg = createCpg(plan.offsets);
  const feet = [0, 1, 2, 3].map(i => { const p = restWorld(start.x, start.z, start.heading, i); return footState({ x: p.x, y: ground(p.x, p.z), z: p.z }); });
  const joints = [0, 1, 2, 3].map(() => Object.fromEntries(KEYS.map(k => [k, spring()])) as Record<typeof KEYS[number], Spring>);
  const body = { height: spring(ground(start.x, start.z)), pitch: spring(), roll: spring() };
  let first = true, jump: Jump | undefined, lastStage = '', landed = false;
  const wasDown = [true, true, true, true], listeners = new Set<(t: Touchdown) => void>();
  const scale = Math.sqrt(legs.hip / SPRINGS.refHip);
  const held = [0, 0]; // T-0003: the fore and hind vault dips of the last frame (they let go over VAULT_RELEASE)

  function update(s: LocoSignals, dt: number, lod: Lod = 'near'): LegPose {
    const moving = Math.abs(s.speed) > .05;
    const prev = plan.id === 'walk' || plan.id === 'trot' || plan.id === 'gallop' ? plan.id as GaitName : undefined;
    plan = planGait(s.speed, legs, s.gait, prev);
    stepCpg(cpg, plan.offsets, moving ? Math.abs(s.speed) / plan.cycle : 0, dt, moving ? 1 : 0);
    const ph = phases(cpg), h = s.heading;
    const hipGround = hips.map(([bx, bz]) => { const p = toWorld(s.x, s.z, h, bx, bz); return ground(p.x, p.z); });
    // mid LOD samples the ground only at the front and hind pair centres
    const t: Tilt = lod === 'near' ? supportPlane(hipGround, wheelbase, track) : (() => {
      const f = toWorld(s.x, s.z, h, 0, (hips[0][1] + hips[2][1]) / 2), b = toWorld(s.x, s.z, h, 0, (hips[1][1] + hips[3][1]) / 2);
      const hf = ground(f.x, f.z), hb = ground(b.x, b.z); return { height: (hf + hb) / 2, pitch: Math.atan2(hf - hb, wheelbase), roll: 0 };
    })();
    const near = lod === 'near' && !first, hl = SPRINGS.body * scale;
    const base = near ? { height: springTo(body.height, t.height, hl, dt), pitch: springTo(body.pitch, t.pitch, hl, dt), roll: springTo(body.roll, t.roll, hl, dt) }
      : (body.height.x = t.height, body.pitch.x = t.pitch, body.roll.x = t.roll, t);
    // jump / pounce: an intent starts one when none is running (callers send it on the frame the jump begins)
    if (!jump && (s.intent?.kind === 'jump' || s.intent?.kind === 'pounce')) jump = { t: 0, kind: s.intent.kind };
    let jf: JumpFrame | undefined;
    if (jump) { jump.t += dt; jf = jumpFrame(jump, legs.hip); if (jf.done) { jump = undefined; jf = undefined; } }
    // T-0003 (wolf walk/trot/gallop): girdle, spine and pitch targets from gaitData.reachTargets at the stride phase
    // (leg i is in stance while its CPG phase < duty, i.e. frac(stride + offset_i) < duty, so stride = frac(ph[1] - offset_1)).
    const stridePhase = ((ph[1] - plan.offsets[1]) % 1 + 1) % 1;
    const gaitPlan = !jf && moving && legs === WOLF_LEGS && (plan.id === 'walk' || plan.id === 'trot' || plan.id === 'gallop')
      ? { gait: plan.id, duty: plan.duty, stride: plan.cycle, offsets: plan.offsets } as CanidPlan : null;
    const reach = gaitPlan ? reachTargets(gaitPlan, stridePhase, WOLF_REACH) : null;
    const bounce = reach ? suspensionBob(stridePhase, plan, s.speed) : !jf && moving && plan.id === 'gallop' ? gallopBob(ph[1], legs.hip, plan.duty) : 0;
    const crouch = jf ? 0 : POSTURE.bodyDrop * legs.hip * carryWeight(s.speed);
    const tilt: Tilt = { height: base.height + bounce - crouch + (jf?.heightOff ?? 0), pitch: base.pitch + (jf ? 0 : POSTURE.bodyPitch * carryWeight(s.speed)) + (jf?.pitchOff ?? 0), roll: base.roll };
    const flex = reach?.spineFlex ?? 0;
    /** Reach inputs of leg i for targets r: the pelvis moves the hind chain tops; the shoulder blade swings by the data (relative to the trunk). */
    const reachOf = (i: number, r = reach): LimbReach => {
      if (!r) return {};
      if (isFrontLeg(i)) return { blade: (limbs[i].girdleRest ?? 0) + r.scapula[i >> 1], fit: true };
      const sh = pelvisShift(r.spineFlex); return { top: { z: sh.z, y: limbs[i].hip + (limbs[i].girdle ?? 0) + sh.y }, fit: true };
    };
    const topOf = (L: typeof limbs[number], r: LimbReach) => r.top ?? { z: 0, y: L.hip + (L.girdle ?? 0) };
    const stage = jf?.stage ?? '';
    if (stage === 'flight' && lastStage !== 'flight') feet.forEach(f => { f.planted = false; f.forced = false; f.from = { ...f.at }; });
    landed = stage === 'land' && lastStage === 'flight';
    if (landed) feet.forEach(f => { f.planted = true; f.forced = false; f.at = { x: f.at.x, y: ground(f.at.x, f.at.z), z: f.at.z }; });
    lastStage = stage;
    const fwd = { x: -Math.sin(h), z: -Math.cos(h) };
    const pose: LegPose = { girdles: [], legs: [], knees: [], wrists: [], paws: [], abduct: [], feet: [], contacts: [], height: tilt.height, pitch: tilt.pitch, roll: tilt.roll,
      gait: plan.id, phases: ph, duty: plan.duty, cycle: plan.cycle, froude: plan.froude, touchdowns: [], spineFlex: flex };
    const rels: Vec3[] = [], lifts: number[] = [], conts: boolean[] = [], ideal: boolean[] = [];
    const cw = jf ? 0 : carryWeight(s.speed); pose.carry = { head: POSTURE.headPitch * cw, drop: POSTURE.headDrop * cw, tail: POSTURE.tailDrop * cw };
    for (let i = 0; i < 4; i++) {
      const L = limbs[i], front = isFrontLeg(i);
      let rel: Vec3, lift: number, contact: boolean;
      if (jf?.stage === 'flight' || (jf && lod !== 'near')) {
        const restZ = restBody(i)[1] - hips[i][1];
        const ff = jf.stage === 'flight' ? flightFoot(front, jf.air, L.hip, jump!.kind, restZ) : { x: 0, y: 0, z: restZ, lift: 0 };
        rel = { x: ff.x + restBody(i)[0] - hips[i][0], y: ff.y, z: ff.z }; lift = ff.lift; contact = jf.stage !== 'flight';
        const w = limbToWorld(rel, s.x, s.z, h, tilt, hips[i]); pose.feet.push(w); feet[i].at = w;
      } else if (lod === 'near') {
        const r = stepFoot(feet[i], { phase: ph[i], duty: plan.duty, cycle: plan.cycle, lift: plan.lift * (front ? 1 + (POSTURE.foreLift - 1) * carryWeight(s.speed) : 1), moving: moving && !jf, reverse: plan.reverse, dt, speed: Math.abs(s.speed), rest: restWorld(s.x, s.z, h, i), fwd }, ground);
        rel = worldToLimb(r.at, s.x, s.z, h, tilt, hips[i]); lift = r.lift; contact = feet[i].planted; pose.feet.push({ ...r.at });
      } else {
        // ideal distance-phased trajectory (core/animalBehavior footTarget), on the tilted body plane
        const stride = plan.duty * plan.cycle, dir = plan.reverse ? -1 : 1, p = ph[i], [, rz] = restBody(i);
        contact = !moving || p < plan.duty; const sw = (p - plan.duty) / (1 - plan.duty);
        rel = moving ? (contact ? { x: 0, y: 0, z: dir * stride * (p / plan.duty - .5) } : { x: 0, y: plan.lift * Math.sin(Math.PI * sw), z: dir * stride * (.5 - smooth01(sw)) }) : { x: 0, y: 0, z: 0 };
        rel.z += rz - hips[i][1]; rel.x += restBody(i)[0] - hips[i][0]; lift = moving && !contact ? Math.sin(Math.PI * sw) : 0;
        pose.feet.push(limbToWorld(rel, s.x, s.z, h, tilt, hips[i])); ideal[i] = true;
      }
      rels.push(rel); lifts.push(lift); conts.push(contact);
    }
    // T-0003 vault (core vaultDips: each leg's touchdown and liftoff needs, joined along its stance and eased in and out
    // over its swing) as body height and pitch about the body centre; then planted paws are topped up so they always reach.
    // World-locked feet are re-expressed in the moved limb frames after each drop.
    const [zF, zH] = WOLF_GIRDLE_Z, dropped = [0, 0];
    let vault = 0; // the vault's share of the pitch, which turns about the trunk (pitchShift)
    const drop = (d: number[]) => {
      const [dF, dH] = d.map((x, e) => Math.max(0, Math.min(x, VAULT_MAX_DROP - dropped[e])));
      if (dF + dH <= 0) return 0;
      dropped[0] += dF; dropped[1] += dH;
      const turn = (dH - dF) / (zH - zF); tilt.pitch += turn; tilt.height += -dF + zF * turn; // fore end drops dF, hind end dH
      vault += turn; tilt.shift = pitchShift(vault, legs.hip);
      for (let i = 0; i < 4; i++) rels[i] = ideal[i] ? rels[i] : worldToLimb(pose.feet[i], s.x, s.z, h, tilt, hips[i]);
      return dF + dH;
    };
    if (gaitPlan && lod === 'near') {
      // stance needs on level ground under a body at its walking crouch and carry pitch (both follow the speed; a slope or a
      // step is left to the top-up), with each leg's touchdown (st = 0) and liftoff (st = 1) sole at its ideal stride position
      const q = vaultPlan(gaitPlan), crouchQ = Math.round(crouch * 1e4) / 1e4, cw = carryWeight(s.speed), pitchQ = Math.round(POSTURE.bodyPitch * cw * 1e4) / 1e4;
      drop(vaultDips(stridePhase, gaitPlan, (i, st) => {
        const L = limbs[i], r = reachOf(i, reachTargets(q, stancePhase(q, i, st), WOLF_REACH)), top = topOf(L, r), [bx, bz] = restBody(i);
        const sole = { x: bx, y: 0, z: bz + (plan.reverse ? -1 : 1) * q.duty * q.stride * (st - .5) };
        let d = 0;
        for (let pass = 0; pass < 4; pass++) {
          const turn = (isFrontLeg(i) ? -d : d) / (zH - zF), height = -crouchQ + (isFrontLeg(i) ? -d : 0) + zF * turn;
          const rel = worldToLimb(sole, 0, 0, 0, { height, pitch: pitchQ + turn, roll: 0, shift: pitchShift(turn, legs.hip) }, hips[i]);
          const c = solveChain(L, bendsForward(legs, i), { z: rel.z, y: top.y - Math.hypot(top.y - rel.y, rel.x) }, L.footAngle ?? 0, top, r.blade, true);
          const n = limbDrop(L, c.joint, c.wristAt); if (n <= 1e-6) break;
          d += n + 1e-5;
        }
        return d;
      }, `loco ${legs.hip} ${q.gait} ${q.duty} ${q.stride} ${plan.reverse} ${crouchQ} ${pitchQ}`));
    }
    for (let pass = 0; reach && pass < 12; pass++) {
      const need = [0, 0];
      for (let i = 0; i < 4; i++) {
        if (!conts[i] || feet[i].forced) continue; // a leash step is a correction, not gait
        const L = limbs[i], r = reachOf(i), top = topOf(L, r), rel = rels[i];
        const c = solveChain(L, bendsForward(legs, i), { z: rel.z, y: top.y - Math.hypot(top.y - rel.y, rel.x) }, (L.footAngle ?? 0) - (L.footFlex ?? 0) * lifts[i], top, r.blade, true);
        need[i & 1] = Math.max(need[i & 1], limbDrop(L, c.joint, c.wristAt));
      }
      if (need[0] <= 1e-7 && need[1] <= 1e-7) break;
      if (drop(need.map(d => d > 1e-7 ? d + 1e-5 : 0)) <= 0) break;
    }
    // a dip engages at once but lets go over VAULT_RELEASE (no pop when a topped-up paw lifts off)
    if (reach) { const keep = Math.exp(-dt / VAULT_RELEASE); drop(held.map((x, e) => x * keep - dropped[e])); held[0] = dropped[0]; held[1] = dropped[1]; }
    else held[0] = held[1] = 0;
    pose.height = tilt.height; pose.pitch = tilt.pitch; pose.shift = tilt.shift;
    for (let i = 0; i < 4; i++) {
      const L = limbs[i], front = isFrontLeg(i), rel = rels[i], lift = lifts[i], rr = reachOf(i);
      let contact = conts[i];
      if (ideal[i]) { pose.feet[i] = limbToWorld(rel, s.x, s.z, h, tilt, hips[i]); if (moving) { feet[i].planted = contact; feet[i].at = pose.feet[i]; } }
      let raw = solveLimb(L, bendsForward(legs, i), rel, lift, rr);
      const topY = topOf(L, rr).y;
      const fits = (r: LimbAngles) => reachError(L, clampLimb(r, front), rel, topY) < 1e-7; // within joint limits and reach
      if (front && lift > 0 && !fits(raw)) { // wrist flick past the joint limits or reach: fold only as far as they allow, keep the paw on target
        let lo = 0, hi = 1; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2, r = solveLimb(L, bendsForward(legs, i), rel, lift * m, rr); if (fits(r)) { lo = m; raw = r; } else hi = m; }
        if (lo === 0) raw = solveLimb(L, bendsForward(legs, i), rel, 0, rr);
      }
      const a: LimbAngles = clampLimb(raw, front);
      if (lod === 'near' && contact && reachError(L, a, rel, topY) > REACH_TOLERANCE) { forceStep(feet[i]); contact = false; } // leash
      const j = joints[i], hj = Math.min(SPRINGS.joint * scale, SWING_SPRING_SHARE * (moving ? (1 - plan.duty) * plan.cycle / Math.max(Math.abs(s.speed), 1e-3) : Infinity)); // lag stays a small share of the swing, so fast gaits don't trail
      // planted legs snap (exact contact), swing legs follow through the spring ("muscle" lag only in the air)
      const out = near && !contact ? Object.fromEntries(KEYS.map(k => [k, springTo(j[k], a[k], hj, dt)])) as Record<typeof KEYS[number], number>
        : (KEYS.forEach(k => { j[k].x = a[k]; j[k].v = 0; }), a);
      pose.girdles.push(out.girdle); pose.legs.push(out.leg); pose.knees.push(out.knee); pose.wrists.push(out.wrist); pose.paws.push(out.paw); pose.abduct.push(out.abduct);
      pose.contacts.push(contact);
    }
    // touchdowns: contact rising edges (none on the first frame, which starts with all four paws down)
    for (let i = 0; i < 4; i++) {
      if (!first && pose.contacts[i] && !wasDown[i]) pose.touchdowns.push({ leg: i, name: LEG_NAMES[i], worldPos: { ...pose.feet[i] }, speed: Math.abs(s.speed), gait: plan.id,
        strength: landed ? 1 : Math.min(1, .3 + .35 * Math.sqrt(plan.froude)), landing: landed });
      wasDown[i] = pose.contacts[i];
    }
    pose.touchdowns.forEach(t => listeners.forEach(fn => fn(t)));
    first = false;
    return pose;
  }
  return { update, feet, cpg, plan: () => plan, jumping: () => !!jump, onTouchdown: fn => (listeners.add(fn), () => { listeners.delete(fn); }) };
}

/** Swing-leg spring half-life is capped at this share of the swing duration. */
export const SWING_SPRING_SHARE = .1;
/** A planted foot further than this (m) from where the limb can reach is lifted (leash). */
export const REACH_TOLERANCE = 1e-6;
/** Distance between a limb target and where the solved, clamped limb actually puts the sole. */
function reachError(L: ReturnType<typeof limbOf>, a: LimbAngles, rel: Vec3, top = L.hip + (L.girdle ?? 0)) {
  const s = soleOf(L, a);
  return Math.hypot(s.z - rel.z, s.y - (top - Math.hypot(top - rel.y, rel.x)));
}

/** World point → limb frame (x right, y up from the tilted body plane, z back, origin at the limb's ground point). */
export function worldToLimb(p: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const vx = p.x - x, vy = p.y - t.height - (t.shift?.y ?? 0), vz = p.z - z;
  const bx = vx * Math.cos(h) - vz * Math.sin(h), bz = vx * Math.sin(h) + vz * Math.cos(h) - (t.shift?.z ?? 0); // undo heading (rotation.y), shift
  const y1 = vy * Math.cos(t.pitch) + bz * Math.sin(t.pitch), z1 = -vy * Math.sin(t.pitch) + bz * Math.cos(t.pitch); // undo pitch (x)
  const x2 = bx * Math.cos(t.roll) + y1 * Math.sin(t.roll), y2 = -bx * Math.sin(t.roll) + y1 * Math.cos(t.roll); // undo roll (z)
  return { x: x2 - hip[0], y: y2, z: z1 - hip[1] };
}
/** Inverse of worldToLimb (tilt group = rotation.x pitch, rotation.z roll inside a rotation.y heading group). */
export function limbToWorld(r: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const bx0 = r.x + hip[0], by0 = r.y, bz0 = r.z + hip[1];
  const x1 = bx0 * Math.cos(t.roll) - by0 * Math.sin(t.roll), y1 = bx0 * Math.sin(t.roll) + by0 * Math.cos(t.roll); // roll
  const y2 = y1 * Math.cos(t.pitch) - bz0 * Math.sin(t.pitch), z2 = y1 * Math.sin(t.pitch) + bz0 * Math.cos(t.pitch); // pitch
  const w = toWorld(x, z, h, x1, z2 + (t.shift?.z ?? 0));
  return { x: w.x, y: y2 + t.height + (t.shift?.y ?? 0), z: w.z };
}
