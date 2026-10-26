/**
 * Globe entry (Matthew, 2026-10-25, final). The orbit view looks straight down. A double-click
 * (or A on the reticle) starts a free fall to 10,000 ft. The fall spins 180° of yaw and opens the
 * pitch to an isometric oblique, both finished at that height. Speed is not zeroed: the handoff
 * keeps the fall's velocity and then steers with photo mode's free-fly (src/photo/fly.ts).
 *
 * There is no auto-start. A single click, a drag and the wheel do not begin the fall.
 * G still drops on the centre. H still flies home.
 */
import { body, step } from '../../proc/physics';

/** 10,000 international feet. The foot is exactly 0.3048 m (NIST SP 811). */
export const FALL_END_M = 10000 * 0.3048;

/** Elevation, radians. 0 is the horizon, negative looks down. Nadir is straight down. */
export const NADIR = -Math.PI / 2;

/**
 * True isometric looks down at arctan(1/√2) ≈ 35.264° (the angle whose tangent is the isometric
 * axis ratio 1 : 1 : 1). The view direction (1,1,1) meets the horizontal at arcsin(1/√3) =
 * arctan(1/√2). That sits inside the 35–45° band below the horizon, so ridges read and the ground
 * stays in frame (Carlbom and Paciorek, ACM Computing Surveys 10(4), 1978).
 */
export const ISO_BELOW_HORIZON = -Math.atan(1 / Math.SQRT2);

/** Smoothstep. Flat at both ends, so the spin eases in and eases out and is done at 10,000 ft. */
export function fallEase(h0: number, h: number, end = FALL_END_M) {
  if (!(h0 > end)) return 1;
  const u = Math.min(1, Math.max(0, (h0 - Math.max(h, end)) / (h0 - end)));
  return u * u * (3 - 2 * u);
}
/** Total yaw through the fall: +180° once ease reaches 1. */
export function fallYaw(yaw0: number, ease: number) { return yaw0 + Math.PI * ease; }
/** Pitch through the fall: nadir at ease 0, the isometric oblique at ease 1. */
export function fallPitch(ease: number) { return NADIR + (ISO_BELOW_HORIZON - NADIR) * ease; }

/** What starts a descent. A drag, a single click and the wheel do not. */
export function isDescentGesture(kind: 'click' | 'dblclick' | 'drag' | 'wheel' | 'pad', dragged = false) {
  if (kind === 'dblclick') return !dragged;
  if (kind === 'pad') return true;
  return false;
}

/**
 * Vertical speed (m/s, negative is down) at `end`, from rest at `h0`, through the one integrator
 * (proc/physics step). Stops on the threshold without zeroing the velocity.
 */
export function fallVelocity(h0: number, end = FALL_END_M, dt = 1 / 60): number {
  if (h0 <= end) return 0;
  const b = body(1, 0, h0, 0);
  for (let i = 0; i < 5_000_000 && b.y > end; i++) step(b, dt, {}, -Infinity);
  return b.vy;
}

export type EntryPhase = 'orbit' | 'fall' | 'drone' | 'game';

/** On-screen line. The orbit line is the way in. The drone line is photo mode's own mapping. */
export function flightPrompt(phase: EntryPhase, pad: boolean): string {
  if (phase === 'orbit') return pad
    ? 'Looking straight down. A drops on the centre. Left stick orbits. Triggers zoom. X flies home. A single press does not drop.'
    : 'Looking straight down. Double-click a point to drop there. Drag orbits. Wheel zooms. H flies home. G drops on the centre. A click does not drop.';
  if (phase === 'fall') return 'Free fall to 10,000 ft. The view turns as you drop. H or pad X goes back to the planet.';
  if (phase === 'drone') return pad
    ? 'Drone · left stick moves · right stick looks · RT up · LT down · A become the wolf · X planet. Speed carries on.'
    : 'Drone · WASD fly · drag look · Q/E or Space/Ctrl down/up · Shift fast · G become the wolf · Esc planet. Same fly as photo mode. Speed carries on.';
  return '';
}
