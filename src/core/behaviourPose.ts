/**
 * Procedural behaviour pose (T-0020). One function of phase, no clips.
 * Wolf gaits call footTarget / gaitFor (the canid solver). Hare gaits call bound footState for the
 * stance window and place the paw with the same sweep the row stored. The diagram in tools/anim-gate.ts
 * does not call this file.
 */
import { gravity } from '../proc/physics';
import { footTarget, gaitFor, limbOf, WOLF_LEGS, type Gait } from './animalBehavior';
import {
  behaviourById, headDownOf, jawOnAt, rotDown, TUCK_HIP_M, type BehaviourAnim, type FootContact, type FootSpec,
} from './behaviourData';
import { footState } from './needs/bound';
import { HARE_GAIT } from './needs/species';

export const KEYS = ['nose', 'ear', 'spine', 'shoulder', 'hip', 'pawLF', 'pawLH', 'pawRF', 'pawRH', 'tail'] as const;
export type KeyName = (typeof KEYS)[number];
export interface Pt { x: number; y: number }
export interface PoseSample {
  phase: number;
  points: Record<KeyName, Pt>;
  /** LF, LH, RF, RH. */
  contact: [FootContact, FootContact, FootContact, FootContact];
  jaw: boolean;
  headDown: boolean;
  airborne: boolean;
}
const PAWS: KeyName[] = ['pawLF', 'pawLH', 'pawRF', 'pawRH'];
const frac = (v: number) => v - Math.floor(v);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** gaitPose's jump height (m). `phase` is 0..1 across PHYS.jumpSeconds. */
export function leapBob(phase: number, leap: NonNullable<BehaviourAnim['leap']>) {
  const T = leap.seconds, c = leap.crouch, fl = leap.flight, Ta = fl * T, g = gravity();
  const t = clamp01(phase), air = clamp01((t - c) / fl), tau = air * Ta, dip = leap.dip, land = 1 - c - fl;
  if (t < c) return -dip * Math.sin((t / c) * Math.PI / 2);
  if (t < c + fl) return -dip * (1 - air) + (g * Ta / 2) * tau - g * tau * tau / 2;
  return -0.8 * dip * Math.sin(Math.min(1, (t - c - fl) / land) * Math.PI);
}

function bodyPoints(b: BehaviourAnim, bob: number): Pick<PoseSample['points'], 'nose' | 'ear' | 'spine' | 'shoulder' | 'hip' | 'tail'> {
  const hip = { x: b.bones.hipX, y: b.bones.hipY - b.drop + bob };
  const shoulder = { x: b.bones.shoulderX, y: b.bones.shoulderY - b.drop + bob };
  const nose0 = { x: b.bones.noseX, y: b.bones.noseY - b.drop + bob };
  const tail = { x: b.bones.tailX, y: b.bones.tailY - b.drop + bob };
  const n = rotDown(nose0.x - shoulder.x, nose0.y - shoulder.y, b.head);
  const e = rotDown(0, b.bones.ear, b.head);
  const nose = { x: shoulder.x + n.x, y: shoulder.y + n.y };
  return {
    hip, shoulder, nose, tail,
    ear: { x: nose.x + e.x, y: nose.y + e.y },
    spine: { x: (hip.x + shoulder.x) / 2, y: (hip.y + shoulder.y) / 2 },
  };
}

/** Hare paw from bound footState. Sweep and lift are the row's, so a changed HARE_GAIT fails the diagram. */
function harePaw(b: BehaviourAnim, phase: number, i: number, spec: FootSpec) {
  const gaitLeg = [0, 2, 1, 3][i];
  const st = footState(HARE_GAIT, phase, gaitLeg, spec.duty);
  if (st.stance || spec.duty >= 1 - 1e-9) {
    const u = spec.duty <= 1e-9 ? 0 : st.u;
    return { x: spec.restX + spec.sweep * (0.5 - u), y: spec.contactY, contact: spec.down };
  }
  const smooth = st.u * st.u * (3 - 2 * st.u);
  const zBack = spec.sweep * (0.5 - smooth);
  return { x: spec.restX - zBack, y: spec.lift * Math.sin(Math.PI * st.u), contact: 'air' as const };
}

function wolfGaitOf(b: BehaviourAnim): Gait {
  const gait = gaitFor('walk', b.speed, WOLF_LEGS);
  if (!gait) throw new Error(`wolf gait missing for ${b.id}`);
  return gait;
}

function wolfPaw(b: BehaviourAnim, phase: number, i: number, spec: FootSpec, gait: Gait) {
  const ft = footTarget(gait, 'walk', phase, i, 0, 0, limbOf(WOLF_LEGS, i).hip);
  const down = frac(phase + gait.offsets[i]) < gait.duty;
  return { x: spec.restX - ft.z, y: ft.y, contact: down ? spec.down : 'air' as const };
}

/** footTarget's jump tuck, without adding bob (the body carries bob; a down foot stays at contactY). */
function leapPaw(b: BehaviourAnim, phase: number, i: number, spec: FootSpec) {
  const leap = b.leap!;
  const t = clamp01(phase), airT = clamp01((t - leap.crouch) / leap.flight);
  const s = Math.sin(airT * Math.PI);
  const push = Math.sin(Math.min(1, airT * 2) * Math.PI);
  const hip = i % 2 === 0 ? b.bones.shoulderY : b.bones.hipY;
  const k = hip / TUCK_HIP_M;
  const front = i % 2 === 0;
  const z = front ? 0.08 * k * s : (0.3 * push + 0.1 * s) * k;
  const tuck = front ? 0.55 * k * s : 0.4 * k * s;
  const flying = t > leap.crouch && t < leap.crouch + leap.flight;
  if (!flying) return { x: spec.restX, y: spec.contactY, contact: spec.down };
  return { x: spec.restX - z, y: Math.max(0, leapBob(phase, leap)) + tuck, contact: 'air' as const };
}

export function sampleBehaviour(id: string, phase: number): PoseSample {
  const b = behaviourById(id);
  const p = frac(phase);
  const bob = b.kind === 'leap' && b.leap ? leapBob(p, b.leap) : 0;
  const gait = b.kind === 'gait' && b.species === 'wolf' ? wolfGaitOf(b) : undefined;
  const limbs = b.feet.map((spec, i) => {
    if (b.kind === 'leap') return leapPaw(b, p, i, spec);
    if (b.kind === 'gait' && b.species === 'wolf') return wolfPaw(b, p, i, spec, gait!);
    if (b.kind === 'gait') return harePaw(b, p, i, spec);
    return { x: spec.restX, y: spec.contactY, contact: spec.down };
  });
  const points = bodyPoints(b, bob) as PoseSample['points'];
  limbs.forEach((L, i) => { points[PAWS[i]] = { x: L.x, y: L.y }; });
  const contact = limbs.map(L => L.contact) as PoseSample['contact'];
  return {
    phase: p, points, contact,
    jaw: jawOnAt(b.jaw, p),
    headDown: headDownOf(points.nose.y, points.shoulder.y),
    airborne: contact.every(c => c === 'air'),
  };
}
