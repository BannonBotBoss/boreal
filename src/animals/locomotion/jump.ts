/**
 * Jump / pounce, driven by LocoSignals.intent. Four stages over PHYS.jumpSeconds (Claude's 0.85 s jump, core/tuning):
 * crouch (preload: body drops, feet planted), launch + flight (ballistic body arc), landing (fore feet reach ahead in a
 * pounce, all feet re-plant where they touch down, body absorbs). Stage shares follow Claude's gaitPose jump
 * (18 % crouch, 65 % air, 17 % landing). The arc is ballistic with g from proc/physics gravity() (rule 4), the same
 * model as proc/physics jumpArc: y(τ) = v₀τ − ½gτ², v₀ = g·T_air/2, apex = g·T_air²/8.
 */
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';
import { live } from '../../config/live';
import { gravity } from '../../proc/physics';
import { PHYS } from '../../core/tuning';
import { smooth01 } from '../../proc/math';

/** Stage shares (Claude's gaitPose), crouch depth and pounce reach as fractions of hip height (game calibration). */
export const JUMP = live(SYSTEM_PROPERTIES.jump);
export type JumpKind = 'jump' | 'pounce';
export type JumpStage = 'crouch' | 'flight' | 'land';
export interface Jump { t: number; kind: JumpKind }
export const jumpSeconds = () => PHYS.jumpSeconds;
export const airSeconds = () => JUMP.flight * jumpSeconds();
/** Highest point of the body arc above the support plane (m). */
export const apexHeight = () => gravity() * airSeconds() ** 2 / 8;

export interface JumpFrame { stage: JumpStage; /** flight progress 0..1 */ air: number; heightOff: number; pitchOff: number; done: boolean }
export function jumpFrame(j: Jump, hip: number): JumpFrame {
  const T = jumpSeconds(), u = j.t / T, c = JUMP.crouch, f = JUMP.flight, depth = JUMP.depth * hip, g = gravity(), Ta = airSeconds();
  if (u < c) { const k = smooth01(u / c); return { stage: 'crouch', air: 0, heightOff: -depth * k, pitchOff: j.kind === 'pounce' ? -.08 * k : 0, done: false }; }
  if (u < c + f) {
    const tau = (u - c) * T, air = tau / Ta;
    return { stage: 'flight', air, heightOff: -depth * (1 - smooth01(air / .2)) + g * Ta / 2 * tau - g * tau * tau / 2, pitchOff: .15 * Math.sin(2 * Math.PI * air), done: false };
  }
  const v = Math.min(1, (u - c - f) / JUMP.land);
  return { stage: 'land', air: 1, heightOff: -.6 * depth * Math.sin(Math.PI * v), pitchOff: -.05 * Math.sin(Math.PI * v), done: u >= 1 };
}
/**
 * Flight foot in the limb frame (y up from the airborne body plane, z back). Feet leave the ground from the crouch,
 * fore legs tuck then (pounce) reach ahead, hind legs push back then tuck; all return to body-plane level at touchdown.
 */
export function flightFoot(front: boolean, air: number, hip: number, kind: JumpKind, restZ: number) {
  const s = Math.sin(Math.PI * air), lift0 = JUMP.depth * hip * (1 - smooth01(air));
  if (front) return { x: 0, y: lift0 + .45 * hip * s, z: restZ - hip * (.12 * s + (kind === 'pounce' ? JUMP.reach * smooth01((air - .35) / .65) : 0)), lift: s };
  const push = Math.sin(Math.min(1, air * 2) * Math.PI);
  return { x: 0, y: lift0 + .35 * hip * s, z: restZ + hip * (.3 * push + .1 * s), lift: s };
}
