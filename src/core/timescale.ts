/**
 * `?timescale=` is the one clock's rate (core/worldClock), not a second scale.
 * A positive number is clamped to RATE_MIN..RATE_MAX; anything else leaves the rate at 1.
 * The saved clock rate is kept when the URL omits the parameter (main applies this only when it is present).
 */
import { clampClockRate } from './worldClock';
export function timescaleFrom(search: string): number {
  const raw = new URLSearchParams(search).get('timescale');
  const s = raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(s) && s > 0 ? clampClockRate(s) : 1;
}
