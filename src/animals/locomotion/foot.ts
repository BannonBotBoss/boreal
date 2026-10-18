/**
 * Foot planning. Timing comes from the CPG phase; placement is world-space. At touchdown a foot is locked where it
 * lands and stays there for the whole stance (no slip, even while the gait changes). In swing it arcs from its lift-off
 * point to a predicted landing point: the hip's ground point plus the distance the body will cover before touchdown
 * plus half the stance sweep, which is where the ideal distance-phased trajectory (core/animalBehavior footTarget)
 * would land. Pattern after majidmanzarpour/threejs-procedural-spider (MIT): planted-in-world feet, analytic terrain.
 */
import { smooth01 } from '../../proc/math';
import type { TerrainFn, Vec3 } from './signals';

export interface FootState { planted: boolean; at: Vec3; from: Vec3; settle: number }
export const footState = (at: Vec3): FootState => ({ planted: true, at: { ...at }, from: { ...at }, settle: 0 });

/** Body frame (x right, z back) → world, for a body at (px, pz) with heading h (three.js rotation.y). */
export const toWorld = (px: number, pz: number, h: number, bx: number, bz: number) =>
  ({ x: px + bx * Math.cos(h) + bz * Math.sin(h), z: pz - bx * Math.sin(h) + bz * Math.cos(h) });

export interface FootStep {
  phase: number; duty: number; cycle: number; lift: number; moving: boolean; reverse: boolean; dt: number;
  /** ground point under this limb's rest position, world */ rest: { x: number; z: number };
  /** unit forward direction, world */ fwd: { x: number; z: number };
}
/** Seconds a foot takes to finish its step when the animal stops mid-stride (game calibration). */
export const SETTLE_SECONDS = .25;

/** Advance one foot; returns its world sole position and the lift fraction (0 planted … 1 top of the arc). */
export function stepFoot(f: FootState, s: FootStep, ground: TerrainFn): { at: Vec3; lift: number } {
  const stance = s.moving ? s.phase < s.duty : f.planted;
  if (stance && !f.planted) { f.planted = true; f.at = { x: f.at.x, y: ground(f.at.x, f.at.z), z: f.at.z }; }
  if (!s.moving && !f.planted) f.settle = Math.min(1, f.settle + s.dt / SETTLE_SECONDS);
  if (!stance && f.planted) { f.planted = false; f.from = { ...f.at }; f.settle = 0; }
  if (f.planted) return { at: f.at, lift: 0 };
  // Swing progress: from the phase while moving, from the settle timer when stopping.
  const sp = s.moving ? (s.phase - s.duty) / (1 - s.duty) : f.settle;
  const ahead = s.moving ? (1 - s.phase) * s.cycle + s.duty * s.cycle / 2 : 0, dir = s.reverse ? -1 : 1;
  const tx = s.rest.x + s.fwd.x * ahead * dir, tz = s.rest.z + s.fwd.z * ahead * dir, ty = ground(tx, tz);
  const k = smooth01(sp), arc = Math.sin(Math.PI * Math.min(1, sp));
  const x = f.from.x + (tx - f.from.x) * k, z = f.from.z + (tz - f.from.z) * k;
  const base = Math.max(f.from.y + (ty - f.from.y) * k, ground(x, z));
  f.at = { x, y: base + s.lift * arc, z };
  if (!s.moving && f.settle >= 1) { f.planted = true; f.at = { x: tx, y: ty, z: tz }; }
  return { at: f.at, lift: arc };
}
