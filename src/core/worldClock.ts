import { SYSTEM_PROPERTIES } from '../config/systemProperties';
/**
 * The ONE clock (Matthew: one clock, one rate, for everything that is simulated or drawn).
 * While it runs, world seconds advance from performance.now at `rate` world-seconds per real second.
 * A hold (menu, the in-game pause button, a frozen photo) freezes it. Resume continues from that
 * snapshot. Between quits the epoch is persisted; the offline gap is accepted only when the wall
 * clock moved forwards and is capped, so setting the system clock back or far ahead cannot rewind
 * or fast-forward the world.
 * Game seconds (needs, weather, ground years) are this clock's unit conversion, not a second rate:
 * 3600 / realSecondsPerGameHour (300 s → ×12).
 */
export const CLOCK = { key: 'boreal.clock.v1', maxOfflineSec: SYSTEM_PROPERTIES.clock.maxOfflineSec as number };
/** World seconds advanced per real second. The only playback rate. */
export const RATE_MIN = 0.05, RATE_MAX = 16;
/** Game seconds per world second. One hour of the day is REAL_SECONDS_PER_GAME_HOUR world seconds. */
export const gameSecondsPerWorldSecond = 3600 / (SYSTEM_PROPERTIES.clock.realSecondsPerGameHour as number);
export const clampClockRate = (r: number) => Math.min(RATE_MAX, Math.max(RATE_MIN, r));

type Saved = { worldSec: number; wallMs: number; rate?: number };
const holds = new Set<string>();
const S = { baseSec: 0, perfAt: 0, frozen: false, rate: 1 };

/** Pure: offline seconds to credit for a saved epoch, rejecting backwards and capping forward jumps. */
export function offlineSec(savedWallMs: number, nowWallMs: number, cap = CLOCK.maxOfflineSec) {
  const d = (nowWallMs - savedWallMs) / 1000; return !isFinite(d) || d < 0 ? 0 : Math.min(d, cap);
}
export function loadClock(raw: string | null, nowWallMs = Date.now(), perfNow = performance.now()) {
  let saved: Saved | undefined; try { saved = raw ? JSON.parse(raw) as Saved : undefined; } catch { saved = undefined; }
  const credited = saved && isFinite(saved.worldSec) ? offlineSec(saved.wallMs, nowWallMs) : 0;
  S.baseSec = (saved && isFinite(saved.worldSec) ? Math.max(0, saved.worldSec) : 0) + credited;
  S.perfAt = perfNow; holds.clear(); S.frozen = false;
  S.rate = saved && Number.isFinite(saved.rate) && (saved.rate as number) > 0 ? clampClockRate(saved.rate as number) : 1;
  return { worldSec: S.baseSec, offlineSec: credited, rate: S.rate };
}
/** World seconds now. Frozen while a hold is set. Advances at `rate` when running. */
export const worldSec = (perfNow = performance.now()) => S.frozen ? S.baseSec : S.baseSec + Math.max(0, perfNow - S.perfAt) / 1000 * S.rate;
export const isPaused = () => S.frozen;
export const clockRate = () => S.rate;
export const clockHeld = (id: string) => holds.has(id);
function catchUp(perfNow: number) { if (!S.frozen) { S.baseSec = worldSec(perfNow); S.perfAt = perfNow; } }
/** Freeze at the current value. Idempotent per id. Several holders can overlap; the clock runs only when none remain. */
export function holdClock(id: string, perfNow = performance.now()) {
  if (holds.has(id)) return;
  catchUp(perfNow); S.frozen = true; holds.add(id);
}
/** Drop one hold. The clock resumes from the frozen value when the last hold is gone. */
export function releaseClock(id: string, perfNow = performance.now()) {
  if (!holds.delete(id)) return;
  if (holds.size === 0) { S.perfAt = perfNow; S.frozen = false; }
}
/** Menu hold. Idempotent. */
export function pauseClock(perfNow = performance.now()) { holdClock('menu', perfNow); }
/** Drop the menu hold. Idempotent. A HUD or photo hold still keeps the clock frozen. */
export function resumeClock(perfNow = performance.now()) { releaseClock('menu', perfNow); }
/** The one rate. Catches the integrator up first so the new rate is not applied backwards. */
export function setClockRate(r: number, perfNow = performance.now()) {
  if (!Number.isFinite(r) || r <= 0) return S.rate;
  catchUp(perfNow); S.rate = clampClockRate(r); return S.rate;
}
/** Halve or double the rate, staying inside RATE_MIN..RATE_MAX. */
export function bumpClockRate(dir: -1 | 1, perfNow = performance.now()) {
  return setClockRate(S.rate * (dir < 0 ? 0.5 : 2), perfNow);
}
/** In-game control: pause and play are the HUD hold; slower and faster step the one rate. */
export function timeCommand(cmd: 'pause' | 'play' | 'slower' | 'faster', perfNow = performance.now()) {
  if (cmd === 'pause') holdClock('hud', perfNow);
  else if (cmd === 'play') releaseClock('hud', perfNow);
  else bumpClockRate(cmd === 'slower' ? -1 : 1, perfNow);
  return { t: worldSec(perfNow), rate: S.rate, paused: S.frozen, hud: holds.has('hud') };
}
/** Keyboard / stick-click: the HUD hold only. The menu hold is Escape. */
export function toggleHudPause(perfNow = performance.now()) {
  if (holds.has('hud')) releaseClock('hud', perfNow); else holdClock('hud', perfNow);
  return isPaused();
}
/** Persist the current world second (frozen or running), the rate, and the wall clock for the offline gap. */
export const saveClock = (nowWallMs = Date.now(), perfNow = performance.now()) => JSON.stringify({ worldSec: worldSec(perfNow), wallMs: nowWallMs, rate: S.rate } satisfies Saved);
