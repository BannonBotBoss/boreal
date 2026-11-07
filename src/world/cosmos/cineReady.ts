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
 * Land once, at the end of B14. The beat from 108 s through Today, the sun grade,
 * vo-b14 and the hero crossfade has to keep stepping.
 * At that end, a booted globe finishes even if the hold frame is `hold` and `earthOn`
 * never flipped (the ready promise can fulfil on that same last frame, after give-up).
 */
export function cineArrivalDue(elapsed: number, _earthOn: boolean, booted: boolean, gaveUp: boolean, arrived: boolean): boolean {
  if (arrived || elapsed < CINE.b14End) return false;
  // At b14End, land if the globe booted or the hold gave up — including booted && !earthOn
  // (gaveUp then ready() just before the last frame), which otherwise leaves the player stuck.
  return booted || gaveUp;
}

/** `?cine-trace=1` or `?inpagedev`. Off otherwise, so a normal visit stays quiet. */
export function cineTrace(line: string) {
  try {
    const q = new URLSearchParams(location.search);
    if (!q.has('inpagedev') && q.get('cine-trace') !== '1') return;
  } catch { return; }
  console.log(line);
}
