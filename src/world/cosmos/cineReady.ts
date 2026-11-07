import { CINE } from './cineBeats';
import { CINE_HOLD_S } from '../globe/bootReady';

export { CINE_HOLD_S };

export interface CineBoot {
  elapsed: number;
  /** Seconds already spent on the B13 clamp. Stays 0 until that clamp first engages. */
  held: number;
  begun: boolean;
  booted: boolean;
  /** ready() rejected, or the clamp has already been held for the grace. A later fulfillment may still set booted. */
  gaveUp: boolean;
  pinned: boolean;
}

export interface CineBootStep {
  elapsed: number;
  held: number;
  gaveUp: boolean;
}

/**
 * One film step. The grace is counted only while the picture is held at the end of B13.
 * It does not run from the click. A diagnostic pin does not burn it and is not pulled back.
 */
export function stepCineBoot(s: CineBoot, dt: number, holdS = CINE_HOLD_S): CineBootStep {
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const cap = CINE.b14End;
  let gaveUp = s.gaveUp;
  let held = s.held;
  if (s.pinned) return { elapsed: Math.min(cap, s.elapsed), held, gaveUp };
  if (!s.begun) return { elapsed: Math.min(CINE.fade, s.elapsed + step), held, gaveUp };
  const next = Math.min(cap, s.elapsed + step);
  if (!s.booted && !gaveUp && next >= CINE.b13End) {
    held += step;
    if (held >= holdS) return { elapsed: next, held, gaveUp: true };
    return { elapsed: CINE.b13End - 0.05, held, gaveUp: false };
  }
  return { elapsed: next, held, gaveUp };
}

/**
 * Land once. A globe that became ready lands on the first B14 frame (the cadence already on main).
 * A boot that rejected or outlasted the clamp grace plays through B14, then lands.
 */
export function cineArrivalDue(elapsed: number, earthOn: boolean, booted: boolean, gaveUp: boolean, arrived: boolean): boolean {
  if (arrived || elapsed < CINE.b13End) return false;
  if (booted && earthOn && elapsed < CINE.b14End) return true;
  if (!booted && gaveUp && elapsed >= CINE.b14End) return true;
  return false;
}
