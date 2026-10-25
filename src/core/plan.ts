/**
 * Route choice shared by every animal (T-0010). A body walks straight to its goal. If that segment crosses a
 * blocker, it compares two costs and takes the cheaper one:
 *   detour — the shorter way around an end, in joules, Taylor, Heglund and Maloiy 1982 (the same split as
 *            core/needs/engine metabolicW), integrated over the extra metres at the travel speed;
 *   jump   — the vertical kinetic energy of the one ballistic hop (proc/physics jumpArc, PHYS.jumpSeconds).
 * A jump is allowed only for a low blocker (a fallen log), and only once the body is inside JUMP_REACH_M,
 * the nose window AnimalBrain already used (ahead < 1.8 m). No goal means no route and no jump.
 * Mass is an argument (rig mass at the call site). Both costs scale with it; the allometric exponent does not
 * cancel, so the caller passes the generated mass rather than a typed constant.
 */
import { jumpArc, kinetic } from '../proc/physics';
import { travelJ } from './needs/engine';
import { rockDiameter } from './rocks';
import { BLOCK, PHYS } from './tuning';
import type { Entity } from './world';

/** Nose window (m): AnimalBrain jumps a low obstacle only when it is this close ahead. The hop still waits until it can clear. */
export const JUMP_REACH_M = 1.8;
/** Metres past the far bark the landing needs, so a 30 Hz step does not finish inside the log. Game clearance. */
export const JUMP_LAND_M = 0.15;
const SIM_DT = 1 / 30;
/** Log mesh (render/geometry.ts): length 4.4 m, large-end radius 0.43 m, local axis +X, group yaw = entity.rotation. */
export const LOG_HALF_M = 2.2;
export const LOG_RADIUS_M = 0.43;
/** Body margin outside the bark so the capsule is not the centreline. Game clearance, not a measured chest. */
export const BODY_CLEAR_M = 0.2;

export interface PlanBlock {
  key: string;
  x: number;
  z: number;
  /** yaw of the long axis (radians, three.js rotation.y) */
  yaw: number;
  /** half-length along yaw; 0 = a round trunk or rock */
  half: number;
  /** clearance radius (m), already including the body margin */
  r: number;
  low: boolean;
}
export interface RoutePlan {
  motion: 'direct' | 'detour' | 'jump' | 'wait';
  heading: number;
  to?: { x: number; z: number };
  block?: string;
  /** J/kg. 0 when nothing is in the way. */
  jumpJPerKg: number;
  detourJPerKg: number;
  extraM: number;
  /** distance from the body to the blocker centreline; Infinity when nothing intersects */
  clearM: number;
}

/** Local +X after a three.js Y rotation: (cos θ, −sin θ). Locked to the mesh by tests/autonomy.test.ts. */
export function logAxis(yaw: number): { x: number; z: number } {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}
/** Heading whose forward (−sin, −cos) points from `from` toward `to`. Same convention as core/agent headingTo. */
export const headingToward = (from: { x: number; z: number }, to: { x: number; z: number }) =>
  Math.atan2(-(to.x - from.x), -(to.z - from.z));

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Minimum distance between segments (p1—q1) and (p2—q2). */
export function segmentDistance(p1x: number, p1z: number, q1x: number, q1z: number, p2x: number, p2z: number, q2x: number, q2z: number): number {
  const d1x = q1x - p1x, d1z = q1z - p1z, d2x = q2x - p2x, d2z = q2z - p2z;
  const rx = p1x - p2x, rz = p1z - p2z;
  const a = d1x * d1x + d1z * d1z, e = d2x * d2x + d2z * d2z, f = d2x * rx + d2z * rz;
  let s: number, t: number;
  if (a <= 1e-12 && e <= 1e-12) return Math.hypot(rx, rz);
  if (a <= 1e-12) { s = 0; t = clamp01(f / e); }
  else {
    const c = d1x * rx + d1z * rz;
    if (e <= 1e-12) { t = 0; s = clamp01(-c / a); }
    else {
      const b = d1x * d2x + d1z * d2z, denom = a * e - b * b;
      s = denom > 1e-9 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); }
      else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  return Math.hypot(p1x + d1x * s - (p2x + d2x * t), p1z + d1z * s - (p2z + d2z * t));
}

function ends(b: PlanBlock, from: { x: number; z: number }, goal: { x: number; z: number }) {
  if (b.half > 0.05) {
    const ax = logAxis(b.yaw), reach = b.half + b.r;
    return [
      { x: b.x + ax.x * reach, z: b.z + ax.z * reach },
      { x: b.x - ax.x * reach, z: b.z - ax.z * reach },
    ];
  }
  const dx = goal.x - from.x, dz = goal.z - from.z, len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len, reach = b.r;
  return [
    { x: b.x + px * reach, z: b.z + pz * reach },
    { x: b.x - px * reach, z: b.z - pz * reach },
  ];
}

let jumpLaunch: number | undefined;
/** J/kg of the vertical launch. jumpArc's launch speed does not depend on mass (v₀ = g·T/2). */
export function jumpJPerKg(): number {
  if (jumpLaunch === undefined) jumpLaunch = jumpArc(1).launch;
  return kinetic(1, jumpLaunch);
}
/**
 * Horizontal metres of one hop at `speed`. Matches autonomousWolfStep: the takeoff frame moves once with
 * jumpTime = dt, then every later frame moves while jumpTime < PHYS.jumpSeconds. Vertical time stays the ballistic arc.
 */
export function jumpHopM(speed: number): number {
  const dt = SIM_DT;
  let jumpTime = dt, frames = 1;
  while (jumpTime < PHYS.jumpSeconds) { jumpTime += dt; frames++; }
  return frames * Math.abs(speed) * dt;
}

/** Blockers the wolf can meet: a log (low, the mesh cylinder), a spruce or a person (trunk clearance), a rock (its generated diameter). */
export function blocksFrom(entities: readonly Pick<Entity, 'key' | 'kind' | 'x' | 'z' | 'rotation' | 'scale' | 'seed'>[]): PlanBlock[] {
  const out: PlanBlock[] = [];
  for (const e of entities) {
    if (e.kind === 'log') out.push({ key: e.key, x: e.x, z: e.z, yaw: e.rotation, half: LOG_HALF_M * e.scale, r: LOG_RADIUS_M * e.scale + BODY_CLEAR_M, low: true });
    else if (e.kind === 'spruce' || e.kind === 'person') out.push({ key: e.key, x: e.x, z: e.z, yaw: 0, half: 0, r: BLOCK.wolf.trunk, low: false });
    else if (e.kind === 'rock') out.push({ key: e.key, x: e.x, z: e.z, yaw: 0, half: 0, r: rockDiameter(e as Entity) / 2, low: false });
  }
  return out;
}

/**
 * The route. `speed` is the travel speed (m/s) the detour is walked at. `walkable` drops a side that lands in water
 * or on a step the body will not take; a dropped side costs Infinity.
 */
export function plan(
  from: { x: number; z: number; heading: number },
  goal: { x: number; z: number } | undefined,
  blocks: readonly PlanBlock[],
  massKg: number,
  speed: number,
  walkable?: (x: number, z: number) => boolean,
): RoutePlan {
  const jump = jumpJPerKg();
  if (!goal) return { motion: 'wait', heading: from.heading, jumpJPerKg: jump, detourJPerKg: 0, extraM: 0, clearM: Infinity };
  const straight = Math.hypot(goal.x - from.x, goal.z - from.z);
  const heading = headingToward(from, goal);
  let hit: PlanBlock | undefined, clear = Infinity;
  for (const b of blocks) {
    const ax = logAxis(b.yaw), half = b.half;
    const x0 = b.x - ax.x * half, z0 = b.z - ax.z * half, x1 = b.x + ax.x * half, z1 = b.z + ax.z * half;
    const gap = segmentDistance(from.x, from.z, goal.x, goal.z, x0, z0, x1, z1);
    // How far the body still is from the centreline. A crossing path has gap 0, but the hop starts at the nose, not at the crossing.
    const along = segmentDistance(from.x, from.z, from.x, from.z, x0, z0, x1, z1);
    if (gap < b.r && along < clear) { clear = along; hit = b; }
  }
  if (!hit) return { motion: 'direct', heading, jumpJPerKg: jump, detourJPerKg: 0, extraM: 0, clearM: Infinity };
  const choices = ends(hit, from, goal).map(to => {
    const ok = !walkable || walkable(to.x, to.z);
    const via = Math.hypot(to.x - from.x, to.z - from.z) + Math.hypot(goal.x - to.x, goal.z - to.z);
    const extra = Math.max(0, via - straight);
    return { to, extra, j: ok ? travelJ(massKg, speed, extra) / massKg : Infinity };
  }).sort((a, b) => a.j - b.j);
  const best = choices[0];
  // Take off outside the bark (clear >= r) and land JUMP_LAND_M past the far side. A log fatter than the hop
  // cannot be cleared at this speed, so the body walks around even when the vertical joules look cheaper.
  const hopM = jumpHopM(speed);
  const takeoffMax = hopM - hit.r - JUMP_LAND_M;
  const jumpable = hit.low && jump < best.j && takeoffMax >= hit.r;
  const inWindow = clear <= Math.min(JUMP_REACH_M, takeoffMax);
  const motion: RoutePlan['motion'] = jumpable ? (inWindow ? 'jump' : 'direct') : best.j < Infinity ? 'detour' : 'wait';
  return {
    motion, heading: motion === 'detour' ? headingToward(from, best.to) : heading, to: best.to,
    block: hit.key, jumpJPerKg: jump, detourJPerKg: best.j, extraM: best.extra, clearM: clear,
  };
}
