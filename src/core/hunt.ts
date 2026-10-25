/**
 * Hunting I (T-0013): hold aim to lock a prey, then a leap that curves onto it until a hunt contact.
 * Pure. Species numbers stay on the agent record (core/agent perceive + notices). These figures are the player's aim
 * and the turn ceiling, read from SYSTEM_PROPERTIES.hunt.
 *
 *   aim stays inside the binocular cone for lockDwell  ->  locked
 *   aim leaves the cone, or the button is up           ->  dropped (no lock without aim)
 *   while jumping at a lock, heading turns at v²/r <= leapGrip until the bodies are within catchPounce
 */
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { HUNT } from './needs/diet';
import type { Contact } from './contactBus';

const P = SYSTEM_PROPERTIES.hunt;
/** Aim dwell, binocular half-angle, lock radius and the leap's lateral-acceleration ceiling. */
export const HUNT_LOCK = {
  dwell: P.lockDwell as number,
  halfDeg: P.lockHalfDeg as number,
  /** cosine of halfDeg: a prey at or above this, along the view, is inside the cone */
  cone: Math.cos((P.lockHalfDeg as number) * Math.PI / 180),
  radius: P.lockRadius as number,
  grip: P.leapGrip as number,
};

export interface AimBody { key: string; x: number; z: number; heading?: number; speed?: number }
/** `key` is the locked prey. `on` is the body the aim is dwelling on. `hold` is seconds on that body. */
export interface LockState { key?: string; on?: string; hold: number }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Cosine of the angle between the view and a body. Heading 0 faces -z (proc/math stepForward). */
export function aimCos(px: number, pz: number, view: number, e: { x: number; z: number }) {
  const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz);
  return d < 1e-6 ? 1 : (-Math.sin(view) * dx - Math.cos(view) * dz) / d;
}
function inAim(self: { x: number; z: number }, view: number, e: AimBody) {
  const d = Math.hypot(e.x - self.x, e.z - self.z);
  return d <= HUNT_LOCK.radius && d > 1e-4 && aimCos(self.x, self.z, view, e) >= HUNT_LOCK.cone - 1e-9;
}

/**
 * One step of the lock. `aiming` is the Lock binding (rebindable). Nothing locks while it is up.
 * A lock already held is kept only while that body stays in the cone and inside the radius.
 * A new lock waits until the same body has been aimed at for HUNT_LOCK.dwell.
 */
export function stepLock(state: LockState, aiming: boolean, view: number, self: { x: number; z: number }, prey: readonly AimBody[], dt: number): LockState {
  if (!aiming) return { hold: 0 };
  if (state.key) {
    const cur = prey.find(e => e.key === state.key);
    if (cur && inAim(self, view, cur)) return { key: cur.key, on: cur.key, hold: state.hold };
    return { hold: 0 };
  }
  let best: AimBody | undefined, score = -Infinity;
  for (const e of prey) {
    if (!inAim(self, view, e)) continue;
    const c = aimCos(self.x, self.z, view, e);
    const s = c - Math.hypot(e.x - self.x, e.z - self.z) / HUNT_LOCK.radius * 0.01;
    if (s > score) { score = s; best = e; }
  }
  if (!best) return { hold: 0 };
  const hold = state.on === best.key ? state.hold + Math.max(0, dt) : Math.max(0, dt);
  if (hold + 1e-9 >= HUNT_LOCK.dwell) return { key: best.key, on: best.key, hold };
  return { on: best.key, hold };
}

/** World velocity of a body. Heading 0 faces -z, so forward is (-sin h, -cos h). */
export function bodyVelocity(b: { heading?: number; speed?: number }) {
  const s = Math.abs(b.speed ?? 0), h = b.heading ?? 0;
  return { vx: -Math.sin(h) * s, vz: -Math.cos(h) * s };
}
/** Where to aim this step: the prey's position after the time the wolf needs to arrive, capped by the jump still left. */
export function leapAim(from: { x: number; z: number }, prey: { x: number; z: number; heading?: number; speed?: number }, wolfSpeed: number, timeLeft: number) {
  const { vx, vz } = bodyVelocity(prey);
  const d = Math.hypot(prey.x - from.x, prey.z - from.z);
  const t = Math.min(Math.max(0, timeLeft), d / Math.max(Math.abs(wolfSpeed), 0.4));
  return { x: prey.x + vx * t, z: prey.z + vz * t };
}
/** Heading after one step, turned toward `aim` at no more than grip/speed rad/s (Wilson et al. 2013 ceiling). */
export function steerLeap(heading: number, from: { x: number; z: number }, aim: { x: number; z: number }, speed: number, dt: number, grip = HUNT_LOCK.grip) {
  const want = Math.atan2(-(aim.x - from.x), -(aim.z - from.z));
  const err = wrap(want - heading);
  const max = (grip / Math.max(Math.abs(speed), 0.4)) * Math.max(0, dt);
  return heading + Math.max(-max, Math.min(max, err));
}

/** Rising-edge contact while a leap is inside the pounce reach, or undefined when it is not. */
export function huntTouch(wolfKey: string, preyKey: string, wolf: { x: number; z: number }, prey: { x: number; z: number }): Contact | undefined {
  const d = Math.hypot(prey.x - wolf.x, prey.z - wolf.z);
  if (d > HUNT.catchPounce) return undefined;
  return { a: wolfKey, b: preyKey, at: [(wolf.x + prey.x) / 2, 0, (wolf.z + prey.z) / 2], normal: [0, 1, 0], kind: 'hunt', source: 'hunt:leap' };
}

/**
 * Position score for a leap. 1 when the closest approach is 0. 0 when the miss equals the range at the start.
 * A straight line that never turns is the known mismatch when the prey is off that line.
 */
export function leapScore(minDist: number, startDist: number) {
  return 1 - minDist / Math.max(startDist, 1e-6);
}
/** Timing score for the lock. 1 when it acquires at `dwell`. 0 when it is off by a full dwell or more. */
export function lockTimingScore(acquiredAt: number, dwell = HUNT_LOCK.dwell) {
  return 1 - Math.min(1, Math.abs(acquiredAt - dwell) / Math.max(dwell, 1e-6));
}
