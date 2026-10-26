import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { K } from './constants';
import { smoothstep } from '../proc/math';
/**
 * The ONE clock (Matthew: one clock, one rate). #109 replaces the old 0.05–16× slider.
 *
 * The dial is a position from −1 (fastest rewind) through 0 (pause) to +1 (fastest forward).
 * Outside a dead zone of 0.01 it maps by powers of ten (#109):
 *   target = sign(position) × 10^(|position| × 12)
 * so 0.1 ≈ 15×, 0.5 ≈ 10^6× and 1 ≈ 10^12× (about 30,000 years of world time per real second).
 * The first notch forward of pause is 10^0.12 ≈ 1.32×, not exactly 1×: the centre is pause, and
 * 10^0 would be 1× only at position 0, which the spec defines as pause.
 *
 * The rate the world actually uses eases toward that target. The spring in #109 is applied in
 * decades (log10 of the rate), with inertia 1 + error², so a small nudge is quick and a jump
 * across the whole dial takes a few seconds. Damping acts on the decade-velocity, so the rate
 * comes to rest ON the target. (Subtracting damping × the rate itself, as one line of #109
 * writes it, would stop short of the target.)
 *
 * Holds (`menu`, `photo`) freeze the integrator at once. The in-game Pause sets the dial to 0
 * and the rate eases to a stop; it is not a second hold. Play puts the dial back where it was.
 *
 * Game seconds (needs, weather step, ground years) are this clock's unit conversion, not a
 * second rate: 3600 / realSecondsPerGameHour (300 s → ×12).
 */
export const CLOCK = { key: 'boreal.clock.v1', maxOfflineSec: SYSTEM_PROPERTIES.clock.maxOfflineSec as number };
/** Game seconds per world second. One hour of the day is REAL_SECONDS_PER_GAME_HOUR world seconds. */
export const gameSecondsPerWorldSecond = 3600 / (SYSTEM_PROPERTIES.clock.realSecondsPerGameHour as number);

/** #109: |position| below this is pause. At the lip, 10^(0.01×12) ≈ 1.32×. */
export const DIAL_DEADZONE = 0.01;
/** #109: full deflection is 10^12 sim seconds per real second. */
export const DIAL_DECADES = 12;
/** One tap of slower/faster, in dial position. Game calibration: about a quarter of a decade (×1.7). */
export const DIAL_NOTCH = 0.02;
/** Dial position per real second while slower or faster is held. Game calibration: −1→+1 takes about 25 s. */
export const DIAL_HOLD_PER_SEC = 0.08;
/**
 * Spring on the log-rate. Game calibration, tuned so one decade settles in well under a second
 * and a 12-decade jump takes a few seconds, with a little overshoot (the "momentum" in #109).
 */
export const DIAL_SPRING = { stiffness: 64, damping: 13.6 };
const LIP_EXP = DIAL_DEADZONE * DIAL_DECADES;
const MAX_EXP = DIAL_DECADES + 2;

export const OBSERVATION_SCALES = ['immediate', 'behavioral', 'ecological', 'seasonal', 'generational', 'evolutionary', 'geological', 'planetary'] as const;
export type ObservationScale = typeof OBSERVATION_SCALES[number];
/**
 * Ceiling of each scale except the last. Cross up at `enter`, back down at `exit`.
 * 800 and 1200 are #109's example (behavior → the next scale). The 10×, 10^5× and 10^7×
 * edges are #108's bands. The three above that split the rest of the dial so Geological
 * and Planetary are reachable before 10^12. Factors 0.8 and 1.2 match 800/1200 around 1000.
 */
export const SCALE_BOUNDS: { above: ObservationScale; exit: number; enter: number }[] = [
  { above: 'behavioral', exit: 8, enter: 12 },
  { above: 'ecological', exit: 800, enter: 1200 },
  { above: 'seasonal', exit: 8e4, enter: 1.2e5 },
  { above: 'generational', exit: 8e6, enter: 1.2e7 },
  { above: 'evolutionary', exit: 8e8, enter: 1.2e9 },
  { above: 'geological', exit: 8e9, enter: 1.2e10 },
  { above: 'planetary', exit: 8e10, enter: 1.2e11 },
];
export type Observation = { scale: ObservationScale; lower: ObservationScale; higher: ObservationScale; blend: number };

/** #109 target rate (sim seconds per real second). 0 inside the dead zone. */
export function targetRateFromDial(position: number): number {
  if (!Number.isFinite(position)) return 0;
  const p = Math.max(-1, Math.min(1, position));
  if (Math.abs(p) < DIAL_DEADZONE) return 0;
  return Math.sign(p) * 10 ** (Math.abs(p) * DIAL_DECADES);
}
/** Dial position for a rate. Below the lip magnitude clamps to the lip, so 1× and slower become the first notch, not rewind. */
export function dialForRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  const mag = Math.abs(rate), sign = Math.sign(rate);
  if (mag <= 10 ** LIP_EXP) return sign * DIAL_DEADZONE; // exactly the lip; log10 of the lip rate can fall inside the dead zone
  if (mag >= 10 ** DIAL_DECADES) return sign;
  return sign * Math.log10(mag) / DIAL_DECADES;
}
/** Rate from the spring's decade coordinate. Below the lip the rate fades to 0, so pause is not a jump from 1×. */
export function rateFromExponent(exp: number): number {
  if (!Number.isFinite(exp)) return 0;
  const a = Math.abs(exp);
  if (a < 1e-8) return 0;
  const fade = a < LIP_EXP ? a / LIP_EXP : 1;
  return Math.sign(exp) * 10 ** Math.min(a, MAX_EXP) * fade;
}
function exponentFor(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  return Math.sign(rate) * Math.log10(Math.abs(rate));
}
/** Decade coordinate that rests on this dial position. The lip uses the exact exponent so float error does not fall into the fade. */
function exponentForDial(dial: number): number {
  if (Math.abs(dial) < DIAL_DEADZONE) return 0;
  if (Math.abs(Math.abs(dial) - DIAL_DEADZONE) < 1e-12) return Math.sign(dial) * LIP_EXP;
  return exponentFor(targetRateFromDial(dial));
}

/** Hysteresis label plus a continuous blend between the two scales that bracket |rate|. The blend does not flicker; the label waits for enter/exit. */
export function resolveObservation(prev: ObservationScale, absRate: number): Observation {
  const rate = Number.isFinite(absRate) ? Math.abs(absRate) : 0;
  let i = OBSERVATION_SCALES.indexOf(prev);
  if (i < 0) i = 0;
  while (i < SCALE_BOUNDS.length && rate > SCALE_BOUNDS[i].enter) i++;
  while (i > 0 && rate < SCALE_BOUNDS[i - 1].exit) i--;
  let lower: ObservationScale = 'planetary', higher: ObservationScale = 'planetary', blend = 1;
  for (let b = 0; b < SCALE_BOUNDS.length; b++) {
    const bound = SCALE_BOUNDS[b], below = OBSERVATION_SCALES[b];
    if (rate < bound.exit) { lower = higher = below; blend = 1; break; }
    if (rate < bound.enter) { lower = below; higher = bound.above; blend = smoothstep(bound.exit, bound.enter, rate); break; }
  }
  return { scale: OBSERVATION_SCALES[i], lower, higher, blend };
}

const UNIT = [
  { sec: 60, name: 'sec' },
  { sec: 3600, name: 'min' },
  { sec: 86400, name: 'hour' },
] as const;
function grouped(n: number): string {
  const rounded = n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
  const [whole, frac] = String(rounded).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
}
/** "paused", "1.32 sec / sec", "1 hour / sec", "1,000 years / sec". A leading − means rewind. */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || Math.abs(rate) < 1e-4) return 'paused';
  const sign = rate < 0 ? '−' : '';
  const a = Math.abs(rate), year = K.julian_year_s;
  const one = (n: number, name: string) => `${sign}${grouped(n)} ${name}${name === 'sec' || Math.abs(n - 1) < 1e-6 ? '' : 's'} / sec`;
  if (a < UNIT[0].sec) return one(a, 'sec');
  if (a < UNIT[1].sec) return one(a / 60, 'min');
  if (a < UNIT[2].sec) return one(a / 3600, 'hour');
  if (a < year) return one(a / 86400, 'day');
  return one(a / year, 'year');
}

type Saved = { worldSec: number; wallMs: number; rate?: number; dial?: number; exp?: number; expVel?: number; parked?: number | null };
const holds = new Set<string>();
const playLip = () => ({ dial: DIAL_DEADZONE, exp: LIP_EXP, expVel: 0, rate: rateFromExponent(LIP_EXP) });
const S = { baseSec: 0, perfAt: 0, frozen: false, ...playLip(), parked: null as number | null, scale: 'immediate' as ObservationScale };

function syncRate() { S.rate = rateFromExponent(S.exp); }
function clampDial(p: number) { return Math.max(-1, Math.min(1, p)); }

/** Pure: offline seconds to credit for a saved epoch, rejecting backwards and capping forward jumps. */
export function offlineSec(savedWallMs: number, nowWallMs: number, cap = CLOCK.maxOfflineSec) {
  const d = (nowWallMs - savedWallMs) / 1000; return !isFinite(d) || d < 0 ? 0 : Math.min(d, cap);
}
export function loadClock(raw: string | null, nowWallMs = Date.now(), perfNow = performance.now()) {
  let saved: Saved | undefined; try { saved = raw ? JSON.parse(raw) as Saved : undefined; } catch { saved = undefined; }
  const credited = saved && isFinite(saved.worldSec) ? offlineSec(saved.wallMs, nowWallMs) : 0;
  S.baseSec = (saved && isFinite(saved.worldSec) ? saved.worldSec : 0) + credited;
  S.perfAt = perfNow; holds.clear(); S.frozen = false;
  const lip = playLip();
  if (saved && Number.isFinite(saved.dial)) S.dial = clampDial(saved.dial as number);
  else if (saved && Number.isFinite(saved.rate) && saved.rate !== 0) S.dial = dialForRate(saved.rate as number);
  else S.dial = lip.dial;
  if (saved && Number.isFinite(saved.exp)) {
    S.exp = Math.max(-MAX_EXP, Math.min(MAX_EXP, saved.exp as number));
    S.expVel = Number.isFinite(saved.expVel) ? saved.expVel as number : 0;
  } else if (saved && Number.isFinite(saved.rate) && saved.rate !== 0) {
    S.exp = exponentForDial(S.dial); S.expVel = 0;
  } else { S.exp = lip.exp; S.expVel = 0; }
  S.parked = saved && Number.isFinite(saved.parked) ? clampDial(saved.parked as number) : null;
  syncRate();
  S.scale = 'immediate';
  S.scale = resolveObservation(S.scale, Math.abs(S.rate)).scale;
  return { worldSec: S.baseSec, offlineSec: credited, rate: S.rate, dial: S.dial };
}

function stepSpring(dt: number) {
  const targetExp = exponentForDial(S.dial);
  const error = targetExp - S.exp;
  const inertia = 1 + error * error;
  const accel = (DIAL_SPRING.stiffness * error - DIAL_SPRING.damping * Math.sqrt(inertia) * S.expVel) / inertia;
  S.expVel += accel * dt;
  S.exp += S.expVel * dt;
  if (S.exp > MAX_EXP) { S.exp = MAX_EXP; S.expVel = 0; }
  if (S.exp < -MAX_EXP) { S.exp = -MAX_EXP; S.expVel = 0; }
  syncRate();
}
function integrate(perfNow: number) {
  if (S.frozen) return;
  let real = (perfNow - S.perfAt) / 1000;
  if (!(real > 0)) { S.perfAt = perfNow; return; }
  const step = 1 / 120;
  while (real > 1e-8) {
    const h = Math.min(step, real);
    stepSpring(h);
    S.baseSec += S.rate * h;
    real -= h;
  }
  S.perfAt = perfNow;
  S.scale = resolveObservation(S.scale, Math.abs(S.rate)).scale;
}
/** World seconds now. Frozen while a hold is set. Advances at the eased rate, which may be negative. */
export const worldSec = (perfNow = performance.now()) => { integrate(perfNow); return S.baseSec; };
export const isPaused = () => S.frozen || (Math.abs(S.dial) < DIAL_DEADZONE && Math.abs(S.rate) < 1e-3);
export const clockRate = () => S.rate;
export const dialPosition = () => S.dial;
export const targetRate = () => targetRateFromDial(S.dial);
export const observation = () => resolveObservation(S.scale, Math.abs(S.rate));
/** Years from the session origin. Pass to deepTimeAt: the planet epoch is that module, not a second clock. */
export const epochOffsetYr = (sec = worldSec()) => sec / K.julian_year_s;
export const clockHeld = (id: string) => holds.has(id);
function catchUp(perfNow: number) { integrate(perfNow); }
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
/** Menu hold. Idempotent. The world stops at once; the dial is left where it is. */
export function pauseClock(perfNow = performance.now()) { holdClock('menu', perfNow); }
/** Drop the menu hold. Idempotent. A photo hold still keeps the clock frozen. */
export function resumeClock(perfNow = performance.now()) { releaseClock('menu', perfNow); }
/**
 * Put the dial on `r` and snap the eased rate there. For a saved clock and `?timescale=` at startup,
 * not for the live bar (that one eases). 0 pauses. Sub-lip magnitudes sit on the first notch.
 */
export function setClockRate(r: number, perfNow = performance.now()) {
  if (!Number.isFinite(r)) return S.rate;
  catchUp(perfNow);
  if (r === 0) { S.dial = 0; S.exp = 0; S.expVel = 0; S.rate = 0; S.scale = resolveObservation(S.scale, 0).scale; return 0; }
  S.dial = dialForRate(r);
  S.exp = exponentForDial(S.dial); S.expVel = 0; syncRate();
  S.scale = resolveObservation(S.scale, Math.abs(S.rate)).scale;
  return S.rate;
}
/** Move the dial. The rate eases; it does not jump. */
export function nudgeDial(delta: number, perfNow = performance.now()) {
  if (!Number.isFinite(delta) || delta === 0) return S.dial;
  catchUp(perfNow);
  S.dial = clampDial(S.dial + delta);
  if (Math.abs(S.dial) >= DIAL_DEADZONE) S.parked = null;
  return S.dial;
}
/** In-game control. Pause and play move the dial (the rate eases). Slower and faster step one notch. */
export function timeCommand(cmd: 'pause' | 'play' | 'slower' | 'faster', perfNow = performance.now()) {
  catchUp(perfNow);
  if (cmd === 'pause') {
    if (Math.abs(S.dial) >= DIAL_DEADZONE) S.parked = S.dial;
    S.dial = 0;
  } else if (cmd === 'play') {
    const back = S.parked != null && Math.abs(S.parked) >= DIAL_DEADZONE ? S.parked : DIAL_DEADZONE;
    S.dial = back; S.parked = null;
  } else nudgeDial((cmd === 'slower' ? -1 : 1) * DIAL_NOTCH, perfNow);
  return { t: S.baseSec, rate: S.rate, target: targetRateFromDial(S.dial), dial: S.dial, paused: isPaused() };
}
/** Keyboard / stick-click: pause if the dial is off centre, otherwise play. */
export function toggleHudPause(perfNow = performance.now()) {
  timeCommand(Math.abs(S.dial) < DIAL_DEADZONE ? 'play' : 'pause', perfNow);
  return isPaused();
}
/**
 * What may follow a world-second delta.
 * Sky and the clock itself use the signed delta (rewind moves the sun backward).
 * Ground years only advance: the column is closed form of elapsed years, and subtracting would pretend decay ran backward.
 * Animals, needs, physics, the weather grid and gameplay audio run only forward, and only while the scale is still Immediate.
 * Above that they hold. Wiring them to the blend is a later task.
 */
export function simWorldSec(wDt: number, obs: Observation = observation()) {
  if (!(wDt > 0) || obs.scale !== 'immediate') return 0;
  return wDt;
}
export function groundWorldSec(wDt: number) { return wDt > 0 ? wDt : 0; }
/** Persist the world second, the dial and the eased rate, and the wall clock for the offline gap. */
export const saveClock = (nowWallMs = Date.now(), perfNow = performance.now()) => JSON.stringify({
  worldSec: worldSec(perfNow), wallMs: nowWallMs, rate: S.rate, dial: S.dial, exp: S.exp, expVel: S.expVel, parked: S.parked,
} satisfies Saved);
