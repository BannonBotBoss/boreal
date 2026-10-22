import { SYSTEM_PROPERTIES } from '../config/systemProperties';
/**
 * The ONE world clock (Grok Bot). While the game is playing it ticks in real seconds (performance.now, monotonic).
 * While the start/pause menu is open the clock is FROZEN (Matthew): age, growth, ripeness, decay, seasons and every
 * other clock-derived field hold their values; the renderer holds a frozen frame. On resume the world continues from
 * that exact snapshot — no catch-up. Between full quits the epoch is persisted; the offline gap is accepted only when
 * the wall clock moved forwards and is capped at CLOCK.maxOfflineSec, so setting the system clock back or far ahead
 * cannot rewind or fast-forward the world (menu pause itself does not write the epoch forward).
 */
export const CLOCK = { key: 'boreal.clock.v1', maxOfflineSec: SYSTEM_PROPERTIES.clock.maxOfflineSec as number };
type Saved = { worldSec: number; wallMs: number };
const S = { baseSec: 0, perfAt: 0, frozen: false };
/** Pure: offline seconds to credit for a saved epoch, rejecting backwards and capping forward jumps. */
export function offlineSec(savedWallMs: number, nowWallMs: number, cap = CLOCK.maxOfflineSec) {
  const d = (nowWallMs - savedWallMs) / 1000; return !isFinite(d) || d < 0 ? 0 : Math.min(d, cap);
}
export function loadClock(raw: string | null, nowWallMs = Date.now(), perfNow = performance.now()) {
  let saved: Saved | undefined; try { saved = raw ? JSON.parse(raw) as Saved : undefined; } catch { saved = undefined; }
  const credited = saved && isFinite(saved.worldSec) ? offlineSec(saved.wallMs, nowWallMs) : 0;
  S.baseSec = (saved && isFinite(saved.worldSec) ? Math.max(0, saved.worldSec) : 0) + credited; S.perfAt = perfNow; S.frozen = false;
  return { worldSec: S.baseSec, offlineSec: credited };
}
/** World seconds now. Frozen while the start/pause menu is open. */
export const worldSec = (perfNow = performance.now()) => S.frozen ? S.baseSec : S.baseSec + Math.max(0, perfNow - S.perfAt) / 1000;
export const isPaused = () => S.frozen;
/** Freeze the global clock at its current value (menu open). Idempotent. */
export function pauseClock(perfNow = performance.now()) { if (S.frozen) return; S.baseSec = worldSec(perfNow); S.perfAt = perfNow; S.frozen = true; }
/** Unfreeze: the next worldSec call resumes from the frozen value. Idempotent. */
export function resumeClock(perfNow = performance.now()) { if (!S.frozen) return; S.perfAt = perfNow; S.frozen = false; }
/** Persist the current world second (frozen or running) plus the wall clock for the offline gap on next load. */
export const saveClock = (nowWallMs = Date.now(), perfNow = performance.now()) => JSON.stringify({ worldSec: worldSec(perfNow), wallMs: nowWallMs } satisfies Saved);
