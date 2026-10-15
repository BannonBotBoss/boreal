/**
 * Shared physics core (Grok Bot). Gravity comes from Newton's law with the Earth's mass/radius (core/tuning PHYS);
 * every moving thing steps through ONE integrator (`step`, semi-implicit Euler). Masses are density x volume from the
 * generators' own dimensions (core/mass.ts). Traced (proc/trace) so the inspector shows the chain.
 */
import { PHYS } from '../core/tuning';
import { f } from './trace';

/** Gravitational acceleration (m/s^2) at an altitude above the surface: g = G M / r^2. */
export const gravity = (altitude = 0) => f('physics', 'g', PHYS.G * PHYS.EARTH_MASS / (PHYS.EARTH_RADIUS + altitude) ** 2);
export const weight = (mass: number, altitude = 0) => mass * gravity(altitude);
export interface Body { mass: number; x: number; y: number; z: number; vx: number; vy: number; vz: number }
export const body = (mass: number, x = 0, y = 0, z = 0): Body => ({ mass, x, y, z, vx: 0, vy: 0, vz: 0 });
/** THE integrator: applies force (N) + gravity for dt, then moves. `ground` stops the fall and returns impact energy (J). */
export function step(b: Body, dt: number, force: { x?: number; y?: number; z?: number } = {}, ground = -Infinity) {
  b.vx += (force.x ?? 0) / b.mass * dt; b.vz += (force.z ?? 0) / b.mass * dt;
  b.vy += ((force.y ?? 0) / b.mass - gravity(Math.max(0, b.y))) * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y <= ground && b.vy < 0) { const e = kinetic(b.mass, b.vy); b.y = ground; b.vy = 0; return e; }
  return 0;
}
export const kinetic = (mass: number, v: number) => .5 * mass * v * v;
export const impulse = (b: Body, j: { x?: number; y?: number; z?: number }) => { b.vx += (j.x ?? 0) / b.mass; b.vy += (j.y ?? 0) / b.mass; b.vz += (j.z ?? 0) / b.mass; };
/** Ballistic jump that lasts `seconds`: launch speed, apex height and the landing impact, all through `step`. */
export function jumpArc(mass: number, seconds = PHYS.jumpSeconds, dt = 1 / 240) {
  const b = body(mass); impulse(b, { y: mass * gravity() * seconds / 2 }); let apex = 0, energy = 0, t = 0;
  while (t < seconds * 2 && !energy) { energy = step(b, dt, {}, 0); apex = Math.max(apex, b.y); t += dt; }
  return { launch: gravity() * seconds / 2, apex, energy, seconds: t };
}
/** Muscle force for a mass (k m^(2/3), calibrated on the wolf), and the acceleration cap it gives. */
export const driveForce = (mass: number, wolfMass: number) => PHYS.wolfAccel * wolfMass ** (1 / 3) * mass ** (2 / 3);
export const accelLimit = (mass: number, wolfMass: number) => driveForce(mass, wolfMass) / mass;
/** Move `v` toward `target` no faster than `a` m/s^2 (inertia). */
export const approach = (v: number, target: number, a: number, dt: number) => v + Math.max(-a * dt, Math.min(a * dt, target - v));
/** 1-D momentum exchange along the contact normal (restitution e). Returns the new velocities. */
export function collide(m1: number, v1: number, m2: number, v2: number, e = .3) {
  const p = m1 * v1 + m2 * v2, M = m1 + m2;
  return [(p + m2 * e * (v2 - v1)) / M, (p + m1 * e * (v1 - v2)) / M];
}
