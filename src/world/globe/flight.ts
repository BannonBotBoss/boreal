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
/** Total yaw through the old fall curve: +180° once ease reaches 1. The seated drop does not apply this.
 *  A half turn with no time to settle is the forced rotation the orbit-to-ground glide leaves out. */
export function fallYaw(yaw0: number, ease: number) { return yaw0 + Math.PI * ease; }
/** Pitch through the fall: nadir at ease 0, the isometric oblique at ease 1. */
export function fallPitch(ease: number) { return NADIR + (ISO_BELOW_HORIZON - NADIR) * ease; }
/** The shortened drop starts part way down the ease. Pitch still opens from nadir, or the
 *  high-air frame looks past the limb and the screen is only the sky colour. */
export function descentPitchEase(progress: number, openedAt: number) {
  const span = 1 - Math.min(1, Math.max(0, openedAt));
  if (span < 1e-6) return 1;
  return Math.min(1, Math.max(0, (progress - openedAt) / span));
}

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

/**
 * A G drop that starts below 10,000 ft has no fall speed to hand over. It falls from rest at that height instead:
 * gravity on the drone's vertical speed through the one integrator (proc/physics), not an invented hand-off speed.
 * Returns the new vertical speed (m/s) after dt at height y (m above the ground).
 */
export function freeFallVy(vy: number, y: number, dt: number): number {
  const b = body(1, 0, y, 0); b.vy = vy; step(b, dt, {}, -Infinity); return b.vy;
}
export type EntryPhase = 'orbit' | 'fall' | 'drone' | 'game';

/**
 * Seated drop from the opening orbit. Gravity from rest at 2.2 radii moves only tens of metres in the first half minute,
 * so the camera eases down a log altitude over `sec` seconds and keeps its heading. The pitch still opens through fallPitch.
 * F, or ?descent=fade, covers the view and arrives at the same glide height.
 */
export const DESCENT = { sec: 14, glideM: 400, fadeOut: 0.45, fadeIn: 0.55, vignette: 0.62,
  /** Share of the ease that is still above the air. The drop starts after it, so the opening is not a black void. */
  vacuum: 0.46 };
export type DescentMode = 'glide' | 'fade';
/** 0 at the start, 1 at `sec`, flat at both ends. */
/** Where a G drop from orbit begins: already in the high air, with the vacuum skipped. */
export function descentBegin(h0: number, vacuum = DESCENT.vacuum) {
  const t = DESCENT.sec * vacuum;
  const p = descentProgress(t);
  return { t, p, y: descentHeight(h0, DESCENT.glideM, p) };
}

export function descentProgress(t: number, sec = DESCENT.sec) {
  const u = Math.min(1, Math.max(0, t / Math.max(sec, 1e-6)));
  return u * u * (3 - 2 * u);
}
/** Log altitude from the start height down to the glide. Progress 0 stays put. Progress 1 is the glide. */
export function descentHeight(h0: number, glide: number, progress: number) {
  const top = Math.max(h0, glide + 1), floor = Math.max(glide, 1), p = Math.min(1, Math.max(0, progress));
  return Math.exp(Math.log(top) + (Math.log(floor) - Math.log(top)) * p);
}
/** One step of the seated drop. `cover` is 0..1 for the vignette (glide) or the black fade. */
export function stepDescent(state: { h0: number; t: number; mode: DescentMode }, dt: number, glide = DESCENT.glideM) {
  const t = state.t + Math.max(0, dt);
  if (state.mode === 'fade') {
    const hold = DESCENT.fadeOut, back = DESCENT.fadeIn;
    const cover = t < hold ? 1 : t < hold + back ? 1 - (t - hold) / back : 0;
    const y = t < hold ? state.h0 : glide;
    return { t, y, p: t >= hold ? 1 : 0, vy: 0, done: t >= hold + back, cover };
  }
  const p = descentProgress(t);
  return { t, y: descentHeight(state.h0, glide, p), p, vy: 0, done: p >= 1 - 1e-9, cover: DESCENT.vignette * Math.sin(Math.PI * Math.min(1, p)) };
}

/** On-screen line. The orbit line is the way in. The drone line is photo mode's own mapping. */
export function flightPrompt(phase: EntryPhase, pad: boolean): string {
  if (phase === 'orbit') return pad
    ? 'Looking straight down. A drops on the centre. Left stick orbits. Triggers zoom. X flies home. A single press does not drop.'
    : 'Looking straight down. Double-click a point to drop there. Drag orbits. Wheel zooms. H flies home. G drops on the centre. F fades down. A click does not drop.';
  if (phase === 'fall') return 'Easing down through the clouds, past 10,000 ft, to a glide above the land. The view opens as you drop. A vignette covers the edges. H or pad X goes back to the planet.';
  if (phase === 'drone') return pad
    ? 'Gliding above the land · left stick moves · right stick looks · RT up · LT down · A become the wolf · X planet. Same drone as photo mode. Speed carries on.'
    : 'Gliding above the land · WASD fly · drag look · Q/E or Space/Ctrl down/up · Shift fast · G become the wolf · Esc planet. Same fly as photo mode. Speed carries on.';
  return '';
}
