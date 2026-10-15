import type { Entity } from './world';
import { random } from './random';
import { smooth01 } from '../proc/math';
import { f } from '../proc/trace';
import { WOLF_SCALE } from './wolfModes';
export const ROCK_SIZES = [.06, .08, .10, .13, .17, .22, .29, .38, .5] as const;
export const PUSH_DISTANCE = .22;
/** Snout tip distance, contact radius and lowered snout height, scaled with the wolf. */
export const SNOUT_REACH = .43 * WOLF_SCALE;
export const SNOUT_RADIUS = .12 * WOLF_SCALE;
export const SNOUT_HEIGHT = .12 * WOLF_SCALE;
export function rockRecipe(seed: number) {
  const rng = random(seed);
  return { shape: f('rock', 'shape', Math.floor(rng() * 9)), size: f('rock', 'sizeClass', Math.min(8, Math.floor(rng() ** 2.5 * 9))),
    flipX: f('rock', 'flipX', rng() < .5 ? -1 : 1), flipY: f('rock', 'flipY', rng() < .5 ? -1 : 1),
    tilt: f('rock', 'tilt', rng() * Math.PI * 2), grey: f('rock', 'grey', .28 + rng() * .4) };
}
export function rockDiameter(e: Entity) { return ROCK_SIZES[rockRecipe(e.seed).size]; }
export function pushContact(player: { x: number; z: number; heading?: number }, rock: Entity) {
  if (rock.kind !== 'rock' || rockDiameter(rock) > .22 || player.heading === undefined) return undefined;
  const fx = -Math.sin(player.heading), fz = -Math.cos(player.heading);
  const dx = rock.x - player.x, dz = rock.z - player.z;
  if (dx * fx + dz * fz < SNOUT_REACH * .65) return undefined;
  const sx = player.x + fx * SNOUT_REACH, sz = player.z + fz * SNOUT_REACH;
  const radius = rockDiameter(rock) / 2;
  // Lowered snout sphere against the rock's spherical contact envelope.
  if (Math.hypot(rock.x - sx, rock.z - sz, radius - SNOUT_HEIGHT) > radius + SNOUT_RADIUS) return undefined;
  const sector = ((Math.round(Math.atan2(sz - rock.z, sx - rock.x) / (Math.PI / 3)) % 6) + 6) % 6;
  const angle = sector * Math.PI / 3;
  return { sector, dx: -Math.cos(angle) * PUSH_DISTANCE, dz: -Math.sin(angle) * PUSH_DISTANCE };
}
export function pushProgress(elapsed: number) {
  return smooth01((elapsed - .25) / .55);
}
