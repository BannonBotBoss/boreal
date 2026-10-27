import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { K } from './constants';
import { smoothstep } from '../proc/math';
/**
 * The ONE clock (Matthew: one clock, one rate). #109 replaces the old 0.05–16× slider.
 *
 * The dial is a position from −1 (fastest rewind) through 0 (pause) to +1 (fastest forward).
 * #109's dead zone is unchanged: |position| below 0.01 is pause. #109's literal map
 * `10^(|position| × 12)` puts exactly 1× on that pause mark, so real time could not be selected.
 * Matthew (2026-10-25): keep the dead zone and the twelve decades, and shift the curve so the
 * edge of the dead zone is exactly 1× and full deflection is still 10^12×:
 *   magnitude = 10^(((|position| − 0.01) / 0.99) × 12)
 * A nudge that crosses ±1× stops on it until the gesture ends. Play sets the dial to +1×.
 *
 * The rate the world actually uses eases toward that target. The spring in #109 is applied in
 * decades, with inertia 1 + error², so a small nudge is quick and a jump across the whole dial
 * takes a few seconds. The decade coordinate is shifted so 0 is pause and ±1 is exactly ±1×
 * (the fade between them). Damping acts on the decade-velocity, so the rate comes to rest ON
 * the target. (Subtracting damping × the rate itself, as one line of #109 writes it, would
 * stop short of the target.)
 *
 * Holds (`menu`, `photo`) freeze the integrator at once. The in-game Pause sets the dial to 0
 * and the rate eases to a stop; it is not a second hold. Play sets the dial to real time.
 *
 * Game seconds (needs, weather step, ground years) are this clock's unit conversion, not a
 * second rate: 3600 / realSecondsPerGameHour (300 s → ×12).
 */
export const CLOCK = { key: 'boreal.clock.v1', maxOfflineSec: SYSTEM_PROPERTIES.clock.maxOfflineSec as number };
/** Game seconds per world second. One hour of the day is REAL_SECONDS_PER_GAME_HOUR world seconds. */
export const gameSecondsPerWorldSecond = 3600 / (SYSTEM_PROPERTIES.clock.realSecondsPerGameHour as number);

/** #109: |position| below this is pause. The edge itself is exactly 1× (see the shifted curve). */
export const DIAL_DEADZONE = 0.01;
/** #109: full deflection is 10^12 sim seconds per real second. */
export const DIAL_DECADES = 12;
/** Save marker for the shifted decade coordinate (1× is internal exponent ±1, not the old log10 lip). */
const DIAL_CURVE = 2;
/** One tap of slower/faster, in dial position. Game calibration: about a quarter of a decade (×1.7). */
export const DIAL_NOTCH = 0.02;
/** Dial position per real second while slower or faster is held. Game calibration: −1→+1 takes about 25 s. */
export const DIAL_HOLD_PER_SEC = 0.08;
/**
 * Spring on the log-rate. Game calibration, tuned so one decade settles in well under a second
 * and a 12-decade jump takes a few seconds, with a little overshoot (the "momentum" in #109).
 */
export const DIAL_SPRING = { stiffness: 64, damping: 13.6 };
/** Internal spring coordinate: 0 is pause, ±1 is exactly ±1×, ±(1+12) is ±10^12×. */
const REALTIME_EXP = 1;
const MAX_EXP = REALTIME_EXP + DIAL_DECADES + 2;
/** Direction of the gesture that is sitting in the ±1× detent. 0 means the next nudge may leave. */
let detentDir = 0;

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

/**
 * Target rate (sim seconds per real second). 0 inside the dead zone.
 * Outside it, magnitude = 10^(((|p| − 0.01) / 0.99) × 12): exactly 1× at the edge, 10^12× at full deflection.
 * That is #109's dead zone and #109's twelve decades, shifted so real time is on the curve.
 */
export function targetRateFromDial(position: number): number {
  if (!Number.isFinite(position)) return 0;
  const p = Math.max(-1, Math.min(1, position));
  if (Math.abs(p) < DIAL_DEADZONE) return 0;
  return rateFromExponent(exponentForDial(p));
}
/** Dial position for a rate. 1× and anything slower sit on the dead-zone edge, so they are real time, not rewind. */
export function dialForRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  const mag = Math.abs(rate), sign = Math.sign(rate);
  if (mag <= 1) return sign * DIAL_DEADZONE;
  if (mag >= 10 ** DIAL_DECADES) return sign;
  const decades = Math.log10(mag);
  return sign * (DIAL_DEADZONE + (decades / DIAL_DECADES) * (1 - DIAL_DEADZONE));
}
/**
 * Rate from the spring coordinate. 0 is pause, ±1 is exactly ±1×, and past that each unit is a decade.
 * Between 0 and 1 the rate fades, so easing into pause is not a jump from 1×.
 */
export function rateFromExponent(exp: number): number {
  if (!Number.isFinite(exp)) return 0;
  const a = Math.abs(exp);
  if (a === 0) return 0;
  const sign = Math.sign(exp);
  if (a < REALTIME_EXP) return sign * a;
  return sign * 10 ** Math.min(a - REALTIME_EXP, DIAL_DECADES + 2);
}
/** Spring coordinate that rests on this dial. The ±1× edge is exactly ±1, so float error cannot miss real time. */
function exponentForDial(dial: number): number {
  const a = Math.abs(dial);
  if (a < DIAL_DEADZONE) return 0;
  const decades = a >= 1 ? DIAL_DECADES : ((a - DIAL_DEADZONE) / (1 - DIAL_DEADZONE)) * DIAL_DECADES;
  return Math.sign(dial) * (REALTIME_EXP + decades);
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
/** "paused", "1 sec / sec", "1 hour / sec", "1,000 years / sec". A leading − means rewind. */
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

type Saved = { worldSec: number; wallMs: number; rate?: number; dial?: number; exp?: number; expVel?: number; parked?: number | null; curve?: number };
const holds = new Set<string>();
const playForward = () => ({ dial: DIAL_DEADZONE, exp: REALTIME_EXP, expVel: 0, rate: rateFromExponent(REALTIME_EXP) });
const S = { baseSec: 0, perfAt: 0, frozen: false, ...playForward(), parked: null as number | null, scale: 'immediate' as ObservationScale };

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
  S.perfAt = perfNow; holds.clear(); S.frozen = false; detentDir = 0;
  const play = playForward();
  if (saved && Number.isFinite(saved.dial)) S.dial = clampDial(saved.dial as number);
  else if (saved && Number.isFinite(saved.rate) && saved.rate !== 0) S.dial = dialForRate(saved.rate as number);
  else S.dial = play.dial;
  // A save from the unshifted curve stores log10(rate) in exp. Snap those to the dial so 0.01 becomes 1×.
  if (saved && saved.curve === DIAL_CURVE && Number.isFinite(saved.exp)) {
    S.exp = Math.max(-MAX_EXP, Math.min(MAX_EXP, saved.exp as number));
    S.expVel = Number.isFinite(saved.expVel) ? saved.expVel as number : 0;
  } else { S.exp = exponentForDial(S.dial); S.expVel = 0; }
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
/** Years the session has run. Pass to deepTimeAt as an offset from now. Not the #108 line: that zero is solar-system formation inside dialToYears. */
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
 * not for the live bar (that one eases). 0 pauses. Magnitudes at or below 1× sit on real time.
 */
export function setClockRate(r: number, perfNow = performance.now()) {
  if (!Number.isFinite(r)) return S.rate;
  catchUp(perfNow);
  detentDir = 0;
  if (r === 0) { S.dial = 0; S.exp = 0; S.expVel = 0; S.rate = 0; S.scale = resolveObservation(S.scale, 0).scale; return 0; }
  S.dial = dialForRate(r);
  S.exp = exponentForDial(S.dial); S.expVel = 0; syncRate();
  S.scale = resolveObservation(S.scale, Math.abs(S.rate)).scale;
  return S.rate;
}
/** The ±1× marks, in the order a move from `before` toward `next` meets them. */
function firstRealtimeLip(before: number, next: number): number | null {
  if (before === next) return null;
  const lips = before < next ? [-DIAL_DEADZONE, DIAL_DEADZONE] : [DIAL_DEADZONE, -DIAL_DEADZONE];
  for (const lip of lips) {
    if ((before - lip) * (next - lip) < 0) return lip;
    if (next === lip && before !== lip) return lip;
  }
  return null;
}
/**
 * Move the dial. The rate eases; it does not jump.
 * A move that crosses ±1× stops on that mark and stays there while the same direction continues.
 * `delta` 0 ends the gesture, so the next nudge can leave real time.
 */
export function nudgeDial(delta: number, perfNow = performance.now()) {
  if (!Number.isFinite(delta)) return S.dial;
  catchUp(perfNow);
  if (delta === 0) { detentDir = 0; return S.dial; }
  if (detentDir !== 0 && Math.sign(delta) === detentDir) return S.dial;
  detentDir = 0;
  const before = S.dial;
  let next = clampDial(before + delta);
  const lip = firstRealtimeLip(before, next);
  if (lip !== null) { next = lip; detentDir = Math.sign(delta); }
  S.dial = next;
  if (Math.abs(S.dial) >= DIAL_DEADZONE) S.parked = null;
  return S.dial;
}
/** In-game control. Pause eases to a stop. Play sets the dial to +1×. A slower or faster tap is one notch, then the gesture ends. */
export function timeCommand(cmd: 'pause' | 'play' | 'slower' | 'faster', perfNow = performance.now()) {
  catchUp(perfNow);
  if (cmd === 'pause') {
    detentDir = 0;
    if (Math.abs(S.dial) >= DIAL_DEADZONE) S.parked = S.dial;
    S.dial = 0;
  } else if (cmd === 'play') {
    detentDir = 0;
    S.dial = DIAL_DEADZONE;
    S.parked = null;
  } else {
    nudgeDial((cmd === 'slower' ? -1 : 1) * DIAL_NOTCH, perfNow);
    nudgeDial(0, perfNow);
  }
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
  worldSec: worldSec(perfNow), wallMs: nowWallMs, rate: S.rate, dial: S.dial, exp: S.exp, expVel: S.expVel, parked: S.parked, curve: DIAL_CURVE,
} satisfies Saved);
