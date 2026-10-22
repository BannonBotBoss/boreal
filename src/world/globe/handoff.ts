/**
 * Globe <-> game handoff (Grok Bot). Descending below HANDOFF.alt over the playable home region hands the player to the
 * game at the same spot and heading, through the game's `?at=x,z,yaw` spawn (main.ts). The game goes back up with
 * `globeUrl` (main.ts: Shift+G or the pause-menu entry), which opens `?view=globe` over the player's spot, same heading.
 * Both directions reload the page; the world clock and the seed carry over through localStorage (the game saves first).
 * Heading: game yaw (forward = (-sin yaw, -cos yaw) in x, z; +x east, -z north) = minus the compass azimuth.
 */
import { PLANET } from './planet';
import { STAGES } from '../../core/stages/elevation';
import { drain, dryStartSteps } from '../../core/stages/surfaceAt';

export const HANDOFF = { alt: 2000, margin: 250, hintAlt: 6000 }; // metres above ground; keep-out from the region edge [game calibration]

/** Game-local spawn (x, z) when the camera at `alt` over a sample with home weight `home` and local (x, z) should hand
 *  off; null otherwise. Only fully inside the region (home weight 1, `margin` from the edge) and while not climbing. */
export function handoffTarget(s: { home: number; x: number; z: number }, alt: number, climbing: boolean) {
  const lim = PLANET.home.halfSize - PLANET.home.feather - HANDOFF.margin;
  if (climbing || alt > HANDOFF.alt || s.home < 1 || Math.abs(s.x) > lim || Math.abs(s.z) > lim) return null;
  return { x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 };
}
/** Where the player lands coming down from the globe: the nearest dry land to `at` (the game's own dryStart, which the
 *  game skips for ?at=), so the handoff never drops the wolf in a lake. Unchanged without staged terrain or if no dry
 *  land is within dryStart's search radius (then the game's water handling applies). */
export function landSpawn(at: { x: number; z: number }, staged = STAGES.on) { return drain(landSpawnSteps(at, staged)); }
/** landSpawn as resumable steps (core/stages dryStartSteps): the in-page descent runs it within a frame budget (inpage.ts). */
export function* landSpawnSteps(at: { x: number; z: number }, staged = STAGES.on): Generator<void, { x: number; z: number }> {
  if (!staged) return at; const [x, z] = yield* dryStartSteps(at.x, at.z);
  return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
}
/** The game URL for a spawn: the current query minus the globe's own keys, plus `at` (x, z and, when known, yaw). */
export function gameUrl(search: string, at: { x: number; z: number; yaw?: number } | null) {
  const q = new URLSearchParams(search);
  for (const k of ['view', 'alt', 'shot', 'bench', 'workers', 'handoff', 'look', 'pitch', 'dir', 'seams']) q.delete(k);
  if (at) q.set('at', at.yaw !== undefined && Number.isFinite(at.yaw) ? `${at.x},${at.z},${at.yaw}` : `${at.x},${at.z}`); else q.delete('at');
  const s = q.toString(); return s ? `?${s}` : '?';
}
/** Altitude (m above ground) the globe opens at when the game goes up: just above the handoff, so zooming in returns. */
export const GLOBE_ENTRY_ALT = HANDOFF.alt * 1.5;
/** The globe URL over the game spot (x, z) with the game heading `yaw`: the current query (game keys stay) plus
 *  view=globe, at=x,z,yaw and the entry altitude. */
export function globeUrl(search: string, x: number, z: number, yaw: number) {
  const q = new URLSearchParams(search), r = (v: number, k: number) => Math.round(v * k) / k;
  q.set('view', 'globe'); q.set('at', `${r(x, 10)},${r(z, 10)},${r(yaw, 1000)}`); q.set('alt', String(GLOBE_ENTRY_ALT));
  return `?${q.toString()}`;
}
