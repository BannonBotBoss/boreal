/**
 * The ONE world clock (Grok Bot). It always ticks in real seconds, through pauses and between sessions (the epoch is
 * persisted). Unrendered objects derive their state from it in closed form as usual. Pause only freezes what is inside
 * the render/interest radius; on resume those are re-derived from the current clock (main.ts: catch-up + short fade).
 * Pause: 'clock' fields (core/stateFields: age, growth, ripeness, decay, seasons, time of day) ALWAYS read worldSec().
 * Only SNAPSHOT state (pose, motion, current action) is frozen: its animation clock is localSec(key) = worldSec() − offset,
 * the offset growing by each pause, so it resumes exactly where it stopped (no catch-up). No offsets for clock fields.
 * Exploit guards: inside a session it runs on performance.now() (monotonic, ignores system-clock changes); between
 * sessions the wall-clock gap is accepted only when it moves forwards and is capped at CLOCK.maxOfflineSec, so setting the
 * system clock back or far ahead cannot rewind or fast-forward the world.
 */
export const CLOCK = { key: 'boreal.clock.v1', maxOfflineSec: 3 * 86400 };
type Saved = { worldSec: number; wallMs: number };
const S = { baseSec: 0, perfAt: 0, lastWall: 0 };
/** Pure: offline seconds to credit for a saved epoch, rejecting backwards and capping forward jumps. */
export function offlineSec(savedWallMs: number, nowWallMs: number, cap = CLOCK.maxOfflineSec) {
  const d = (nowWallMs - savedWallMs) / 1000; return !isFinite(d) || d < 0 ? 0 : Math.min(d, cap);
}
export function loadClock(raw: string | null, nowWallMs = Date.now(), perfNow = performance.now()) {
  let saved: Saved | undefined; try { saved = raw ? JSON.parse(raw) as Saved : undefined; } catch { saved = undefined; }
  const credited = saved && isFinite(saved.worldSec) ? offlineSec(saved.wallMs, nowWallMs) : 0;
  S.baseSec = (saved && isFinite(saved.worldSec) ? Math.max(0, saved.worldSec) : 0) + credited; S.perfAt = perfNow; S.lastWall = nowWallMs;
  return { worldSec: S.baseSec, offlineSec: credited };
}
/** World seconds now (monotonic). */
export const worldSec = (perfNow = performance.now()) => S.baseSec + Math.max(0, perfNow - S.perfAt) / 1000;
export const saveClock = (nowWallMs = Date.now(), perfNow = performance.now()) => JSON.stringify({ worldSec: worldSec(perfNow), wallMs: nowWallMs } satisfies Saved);
/** Per-object pause offsets (seconds frozen). */
const offsets = new Map<string, number>(); let pausedAt: number | undefined, pausedKeys: string[] = [];
export const offset = (key: string) => offsets.get(key) ?? 0;
/** The object's own clock: world time minus the time it spent frozen. */
export const localSec = (key: string, perfNow = performance.now()) => (pausedAt !== undefined && pausedKeys.includes(key) ? pausedAt : worldSec(perfNow)) - offset(key);
/** Freeze these objects (the in-radius set + the player) at their current local time. */
export function pause(keys: string[], perfNow = performance.now()) { if (pausedAt !== undefined) return; pausedAt = worldSec(perfNow); pausedKeys = [...keys];
  for (const k of [...offsets.keys()]) if (!pausedKeys.includes(k)) offsets.delete(k); } // left the radius since: back on world time
/** Resume: every frozen object's offset grows by the paused duration, so it continues from its snapshot (no catch-up). */
export function resume(perfNow = performance.now()) {
  if (pausedAt === undefined) return 0; const d = worldSec(perfNow) - pausedAt;
  for (const k of pausedKeys) offsets.set(k, offset(k) + d); pausedAt = undefined; pausedKeys = []; return d;
}
/** Out of radius again: the object rejoins the world clock (its state is derived from it). */
export const release = (key: string) => { offsets.delete(key); };
export const isPaused = () => pausedAt !== undefined;
/** Persist / restore the offsets of objects that are still in radius (e.g. the player). */
export const saveOffsets = () => JSON.stringify([...offsets]);
export function loadOffsets(raw: string | null) { offsets.clear(); try { for (const [k, v] of JSON.parse(raw ?? '[]') as [string, number][]) if (isFinite(v) && v >= 0) offsets.set(k, v); } catch { /* fresh */ } }
