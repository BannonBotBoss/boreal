/**
 * Slow-motion review (T-0002, grok-gait): `?timescale=s`, 0.05-1, read from the URL only, never saved.
 * main.ts multiplies the frame dt by it once, before the fixed-step accumulator, so the player's movement, animal AI and
 * movement (buildScene derives their dt from simTime), gaits, touchdowns and shaderClock effects (wind, water) slow together.
 * The world clock (worldSec: saves, offline credit), sun, seasons, weather, audio, camera look, input and UI stay on real time.
 */
export function timescaleFrom(search: string): number {
  const raw = new URLSearchParams(search).get('timescale');
  const s = raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(s) && s > 0 ? Math.min(1, Math.max(.05, s)) : 1;
}
export const TIMESCALE = typeof location === 'undefined' ? 1 : timescaleFrom(location.search);
