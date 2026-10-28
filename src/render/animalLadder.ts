/**
 * Distance ladder for one animal picture (issue #156). Thresholds live here,
 * not at the call site. Farther than speckM the animal is a point. Between
 * speckM and fullM it is a low body. Inside fullM it is the full model when
 * one is loaded, otherwise the procedural body.
 *
 * The glide stop is a few hundred metres: under #107's 1 km habitat station
 * and above its 100 m animal station. [game calibration]
 */
import { smoothstep } from '../proc/math';

export const ANIMAL_LADDER = {
  /** Eye height where a double-click stops and the drone glides, metres above ground. */
  mapHoldM: 400,
  /** Full model (or the procedural body) is solid inside this distance. */
  fullM: 16,
  /** Low body between fullM and this distance; specks begin here. */
  lowM: 48,
  /** Specks are the whole picture beyond this distance. */
  speckM: 140,
  speckCap: 2000,
  /** Instanced impostor quads. One draw call per species, two triangles each. */
  lowCap: 16,
  /** Nearest skinned meshes. About 26k triangles each; six stay under the Quest triangle cap along with the forest. */
  fullCap: 6,
  /** Screen pixels. A fixed size cannot swell into a dome. */
  speckPx: 3.5,
  /** Horizontal speed left when the fall is arrested, m/s. Between the photo fly's 6 and 25. [game calibration] */
  glideMs: 8,
  /** Below this speed the body counts as standing still, so a stored model may show. */
  stillMs: 0.35,
} as const;

export interface DetailShares { full: number; low: number; speck: number }

/** The three weights sum to 1. They crossfade; none of them pops on a single frame. */
export function detailShares(distanceM: number, L = ANIMAL_LADDER): DetailShares {
  const full = 1 - smoothstep(L.fullM, L.lowM, distanceM);
  const speck = smoothstep(L.lowM, L.speckM, distanceM);
  const low = Math.max(0, 1 - full - speck);
  return { full, low, speck };
}

/** The player is flying downward on purpose. Carried fall speed is not this. */
export function playerDiving(u: number, f: number, pitch: number) {
  return u < -0.02 || (f > 0.15 && pitch < -0.25);
}

/** Photo floor while diving. Otherwise the glide height, and never under the photo floor. */
export function descentFloorY(groundY: number, photoFloorY: number, diving: boolean, holdM = ANIMAL_LADDER.mapHoldM) {
  return diving ? photoFloorY : Math.max(photoFloorY, groundY + holdM);
}

/**
 * At the glide height, drop the vertical speed and keep a horizontal glide.
 * A second call with vy already at 0 leaves the velocity alone, so the glide
 * is not restarted every frame.
 */
export function arrestGlide(vel: { x: number; y: number; z: number }, yaw: number, atHold: boolean, diving: boolean) {
  if (diving || !atHold || vel.y >= -0.5) return vel;
  const speed = Math.min(ANIMAL_LADDER.glideMs, Math.max(ANIMAL_LADDER.glideMs, Math.hypot(vel.x, vel.z)));
  return { x: -Math.sin(yaw) * speed, y: 0, z: -Math.cos(yaw) * speed };
}

/** The fall crosses the local cloud box, then the drone continues under the shell deck. */
export function descentCrossesClouds(shellM: number, localTopM: number, fallEndM: number, holdM: number) {
  return fallEndM < localTopM && holdM < shellM && holdM < fallEndM;
}
