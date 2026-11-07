import { CINE } from './cineBeats';
import { BOOT_READY_MS } from '../globe/bootReady';

/** Same budget as the globe's boot promise, in cinematic seconds. */
export const CINE_BOOT_DEADLINE_S = BOOT_READY_MS / 1000;

export interface CineBoot {
  elapsed: number;
  /** Cinematic seconds since the click while readiness was still pending. Not counted while a diagnostic pin is held. */
  waited: number;
  begun: boolean;
  booted: boolean;
  /** ready() rejected, or the measured budget ran out. A later fulfillment may still set booted. */
  gaveUp: boolean;
  pinned: boolean;
}

export interface CineBootStep {
  elapsed: number;
  waited: number;
  gaveUp: boolean;
}

/**
 * One film step. While the measured budget remains and the globe is not ready, the drift
 * holds at the end of B13. Past that budget, B14 is allowed to play. A diagnostic pin
 * (`?cine=B7` / `?cine=shot`) does not burn the budget and does not get pulled back.
 */
export function stepCineBoot(s: CineBoot, dt: number, deadlineS = CINE_BOOT_DEADLINE_S): CineBootStep {
  const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
  const cap = CINE.b14End;
  let gaveUp = s.gaveUp;
  let waited = s.waited;
  if (s.begun && !s.booted && !gaveUp && !s.pinned) {
    waited += step;
    if (waited >= deadlineS) gaveUp = true;
  }
  if (s.pinned) return { elapsed: Math.min(cap, s.elapsed), waited, gaveUp };
  if (!s.begun) return { elapsed: Math.min(CINE.fade, s.elapsed + step), waited, gaveUp };
  const next = Math.min(cap, s.elapsed + step);
  if (!s.booted && !gaveUp && next >= CINE.b13End) return { elapsed: CINE.b13End - 0.05, waited, gaveUp: false };
  return { elapsed: next, waited, gaveUp };
}

/**
 * Land once. A globe that became ready lands on the first B14 frame (the cadence already on main).
 * A boot that rejected or missed the measured budget plays through B14, then lands.
 */
export function cineArrivalDue(elapsed: number, earthOn: boolean, booted: boolean, gaveUp: boolean, arrived: boolean): boolean {
  if (arrived || elapsed < CINE.b13End) return false;
  if (booted && earthOn && elapsed < CINE.b14End) return true;
  if (!booted && gaveUp && elapsed >= CINE.b14End) return true;
  return false;
}
