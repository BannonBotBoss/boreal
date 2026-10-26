/**
 * `?timescale=` sets the one clock's dial (core/worldClock), not a second scale.
 * A finite non-zero number is placed on the log dial: the edge of the pause zone is exactly 1×, full deflection is 10^12×,
 * and a negative number is rewind. Zero or junk lands on forward real time, not on the old 0.05–16 clamp.
 * The saved dial is kept when the URL omits the parameter (main applies this only when it is present).
 */
import { DIAL_DEADZONE, dialForRate, targetRateFromDial } from './worldClock';
export function timescaleFrom(search: string): number {
  const raw = new URLSearchParams(search).get('timescale');
  const s = raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(s) || s === 0) return targetRateFromDial(DIAL_DEADZONE);
  return targetRateFromDial(dialForRate(s));
}
