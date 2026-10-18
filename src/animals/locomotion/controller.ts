/**
 * Locomotion controller: signals → CPG phases → feet (world-planted, terrain-sampled) → body tilt → limb IK → joint
 * springs. One instance per animal; all state is plain numbers (snapshot-friendly) and nothing is random.
 * LOD (PROJECT-RULES rule 8): 'near' = everything above; 'mid' = the same CPG phases driving the ideal flat
 * trajectory on the tilted body plane (2 ground samples, no foot locks, no springs). Far = no instance at all.
 */
import { WOLF_LEGS, bendsForward, isFrontLeg, limbOf } from '../../core/animalBehavior';
import { LEG_XZ } from '../../core/wolfBody';
import { WOLF_SCALE } from '../../core/wolfModes';
import { createCpg, phases, stepCpg, type Cpg } from './cpg';
import { footState, stepFoot, toWorld, type FootState } from './foot';
import { planGait, type GaitPlan } from './gaits';
import { clampLimb, solveLimb, type LimbAngles } from './ik';
import { supportPlane, type Tilt } from './balance';
import { spring, springTo, type Spring } from './spring';
import type { LegLayout, LegPose, LocoSignals, Lod, TerrainFn, Vec3 } from './signals';
import { smooth01 } from '../../proc/math';

/** The reference test body: Claude's real-size gray-wolf legs (WOLF_LEGS) and limb positions (LEG_XZ × WOLF_SCALE). Read only. */
export const referenceLayout = (): LegLayout => ({ legs: WOLF_LEGS, hips: LEG_XZ.map(([x, z]) => [x * WOLF_SCALE, z * WOLF_SCALE] as const) });

/** Joint and body spring half-lives (s) at a 0.55 m hip, scaled by √(hip / 0.55) (dynamic similarity; game calibration). */
export const SPRINGS = { joint: .025, body: .08, refHip: .55 };
const KEYS = ['girdle', 'leg', 'knee', 'wrist', 'paw', 'abduct'] as const;

export interface Locomotion {
  update(s: LocoSignals, dt: number, lod?: Lod): LegPose;
  readonly feet: FootState[]; readonly cpg: Cpg; plan(): GaitPlan;
}

export function createLocomotion(layout: LegLayout, ground: TerrainFn, start: { x: number; z: number; heading: number }): Locomotion {
  const { legs, hips } = layout;
  const limbs = [0, 1, 2, 3].map(i => limbOf(legs, i));
  const restBody = (i: number) => [hips[i][0], hips[i][1] - (limbs[i].stance ?? 0)] as const;
  const restWorld = (x: number, z: number, h: number, i: number) => toWorld(x, z, h, ...restBody(i));
  const wheelbase = Math.abs((hips[1][1] + hips[3][1]) / 2 - (hips[0][1] + hips[2][1]) / 2);
  const track = Math.abs((hips[2][0] + hips[3][0]) / 2 - (hips[0][0] + hips[1][0]) / 2);
  let plan = planGait(0, legs, 'walk');
  const cpg = createCpg(plan.offsets);
  const feet = [0, 1, 2, 3].map(i => { const p = restWorld(start.x, start.z, start.heading, i); return footState({ x: p.x, y: ground(p.x, p.z), z: p.z }); });
  const joints = [0, 1, 2, 3].map(() => Object.fromEntries(KEYS.map(k => [k, spring()])) as Record<typeof KEYS[number], Spring>);
  const body = { height: spring(ground(start.x, start.z)), pitch: spring(), roll: spring() };
  let first = true;
  const scale = Math.sqrt(legs.hip / SPRINGS.refHip);

  function update(s: LocoSignals, dt: number, lod: Lod = 'near'): LegPose {
    const moving = Math.abs(s.speed) > .05;
    plan = planGait(s.speed, legs, s.gait);
    stepCpg(cpg, plan.offsets, moving ? Math.abs(s.speed) / plan.cycle : 0, dt, moving ? 1 : 0);
    const ph = phases(cpg), h = s.heading;
    const hipGround = hips.map(([bx, bz]) => { const p = toWorld(s.x, s.z, h, bx, bz); return ground(p.x, p.z); });
    // mid LOD samples the ground only at the front and hind pair centres
    const t: Tilt = lod === 'near' ? supportPlane(hipGround, wheelbase, track) : (() => {
      const f = toWorld(s.x, s.z, h, 0, (hips[0][1] + hips[2][1]) / 2), b = toWorld(s.x, s.z, h, 0, (hips[1][1] + hips[3][1]) / 2);
      const hf = ground(f.x, f.z), hb = ground(b.x, b.z); return { height: (hf + hb) / 2, pitch: Math.atan2(hf - hb, wheelbase), roll: 0 };
    })();
    const near = lod === 'near' && !first, hl = SPRINGS.body * scale;
    const tilt = near ? { height: springTo(body.height, t.height, hl, dt), pitch: springTo(body.pitch, t.pitch, hl, dt), roll: springTo(body.roll, t.roll, hl, dt) }
      : (body.height.x = t.height, body.pitch.x = t.pitch, body.roll.x = t.roll, t);
    const fwd = { x: -Math.sin(h), z: -Math.cos(h) };
    const pose: LegPose = { girdles: [], legs: [], knees: [], wrists: [], paws: [], abduct: [], feet: [], contacts: [], height: tilt.height, pitch: tilt.pitch, roll: tilt.roll,
      gait: plan.id, phases: ph, duty: plan.duty, cycle: plan.cycle, froude: plan.froude };
    for (let i = 0; i < 4; i++) {
      const L = limbs[i], front = isFrontLeg(i);
      let rel: Vec3, lift: number, contact: boolean;
      if (lod === 'near') {
        const r = stepFoot(feet[i], { phase: ph[i], duty: plan.duty, cycle: plan.cycle, lift: plan.lift, moving, reverse: plan.reverse, dt, rest: restWorld(s.x, s.z, h, i), fwd }, ground);
        rel = worldToLimb(r.at, s.x, s.z, h, tilt, hips[i]); lift = r.lift; contact = feet[i].planted; pose.feet.push({ ...r.at });
      } else {
        // ideal distance-phased trajectory (core/animalBehavior footTarget), on the tilted body plane
        const stride = plan.duty * plan.cycle, dir = plan.reverse ? -1 : 1, p = ph[i], [, rz] = restBody(i);
        contact = !moving || p < plan.duty; const sw = (p - plan.duty) / (1 - plan.duty);
        rel = moving ? (contact ? { x: 0, y: 0, z: dir * stride * (p / plan.duty - .5) } : { x: 0, y: plan.lift * Math.sin(Math.PI * sw), z: dir * stride * (.5 - smooth01(sw)) }) : { x: 0, y: 0, z: 0 };
        rel.z += rz - hips[i][1]; lift = moving && !contact ? Math.sin(Math.PI * sw) : 0;
        pose.feet.push(limbToWorld(rel, s.x, s.z, h, tilt, hips[i]));
        if (moving) { feet[i].planted = contact; feet[i].at = pose.feet[i]; }
      }
      const a: LimbAngles = clampLimb(solveLimb(L, bendsForward(legs, i), rel, lift), front);
      const j = joints[i], hj = SPRINGS.joint * scale;
      const out = near ? Object.fromEntries(KEYS.map(k => [k, springTo(j[k], a[k], hj, dt)])) as Record<typeof KEYS[number], number>
        : (KEYS.forEach(k => { j[k].x = a[k]; j[k].v = 0; }), a);
      pose.girdles.push(out.girdle); pose.legs.push(out.leg); pose.knees.push(out.knee); pose.wrists.push(out.wrist); pose.paws.push(out.paw); pose.abduct.push(out.abduct);
      pose.contacts.push(contact);
    }
    first = false;
    return pose;
  }
  return { update, feet, cpg, plan: () => plan };
}

/** World point → limb frame (x right, y up from the tilted body plane, z back, origin at the limb's ground point). */
export function worldToLimb(p: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const vx = p.x - x, vy = p.y - t.height, vz = p.z - z;
  const bx = vx * Math.cos(h) - vz * Math.sin(h), bz = vx * Math.sin(h) + vz * Math.cos(h); // undo heading (rotation.y)
  const y1 = vy * Math.cos(t.pitch) + bz * Math.sin(t.pitch), z1 = -vy * Math.sin(t.pitch) + bz * Math.cos(t.pitch); // undo pitch (x)
  const x2 = bx * Math.cos(t.roll) + y1 * Math.sin(t.roll), y2 = -bx * Math.sin(t.roll) + y1 * Math.cos(t.roll); // undo roll (z)
  return { x: x2 - hip[0], y: y2, z: z1 - hip[1] };
}
/** Inverse of worldToLimb (tilt group = rotation.x pitch, rotation.z roll inside a rotation.y heading group). */
export function limbToWorld(r: Vec3, x: number, z: number, h: number, t: Tilt, hip: readonly [number, number]): Vec3 {
  const bx0 = r.x + hip[0], by0 = r.y, bz0 = r.z + hip[1];
  const x1 = bx0 * Math.cos(t.roll) - by0 * Math.sin(t.roll), y1 = bx0 * Math.sin(t.roll) + by0 * Math.cos(t.roll); // roll
  const y2 = y1 * Math.cos(t.pitch) - bz0 * Math.sin(t.pitch), z2 = y1 * Math.sin(t.pitch) + bz0 * Math.cos(t.pitch); // pitch
  const w = toWorld(x, z, h, x1, z2);
  return { x: w.x, y: y2 + t.height, z: w.z };
}
