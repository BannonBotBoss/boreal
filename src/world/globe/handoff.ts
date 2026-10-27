/**
 * Globe <-> game handoff (Grok Bot). Descending below HANDOFF.alt over the playable home region hands the player to the
 * game at the same spot and heading, through the game's `?at=x,z,yaw` spawn (main.ts). The game goes back up with
 * `globeUrl` (main.ts: Shift+G or the pause-menu entry), which opens `?view=globe` over the player's spot, same heading.
 * Both directions reload the page; the world clock and the seed carry over through localStorage (the game saves first).
 * Heading: game yaw (forward = (-sin yaw, -cos yaw) in x, z; +x east, -z north) = minus the compass azimuth.
 */
import { PLANET } from './planet';
import { STAGES } from '../../core/stages/elevation';
import { drain, dryStartSteps, isDry } from '../../core/stages/surfaceAt';
import { solidsAround, treesAround, type Solid } from '../../core/ground';
import { SYSTEM_PROPERTIES } from '../../config/systemProperties';

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
export function landSpawn(at: { x: number; z: number }, staged = STAGES.on, yaw?: number) { return drain(landSpawnSteps(at, staged, yaw)); }
/** landSpawn as resumable steps (core/stages dryStartSteps): the in-page descent runs it within a frame budget (inpage.ts). */
export function* landSpawnSteps(at: { x: number; z: number }, staged = STAGES.on, yaw?: number): Generator<void, { x: number; z: number }> {
  const [x, z] = staged ? yield* dryStartSteps(at.x, at.z) : [at.x, at.z];
  const spot = staged ? { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 } : at;
  return yaw === undefined ? spot : yield* clearViewSteps(spot, yaw, staged ? (px, pz) => isDry(px, pz) : () => true);
}
/** T-0041, T-0101: the follow camera sits `back` m straight behind the wolf (`flank` is 0, the same dead-astern line as
 *  positionCamera) and `eye` m up; a tree within clear(r) of the camera-wolf line hides the wolf on landing (trunk plus the lower
 *  crown; r = crown radius from core/ground). Rocks and logs (core/ground solidsAround) hide it when they reach the line within
 *  `pad` m and stand taller than the line there (it runs from `aim` m up at the wolf to the camera), so pebbles and low logs beside
 *  the wolf's feet do not count. The spot may move up to maxShift m. */
export const LANDING_VIEW = { back: SYSTEM_PROPERTIES.camera.riderDistance + .5, flank: SYSTEM_PROPERTIES.camera.flank, eye: SYSTEM_PROPERTIES.camera.riderHeight, aim: .5, pad: .15,
  clear: (r: number) => Math.max(.6, .45 * r), step: 1.5, maxShift: 12 };
export function viewBlocked(x: number, z: number, yaw: number, trees: readonly { x: number; z: number; r: number }[], solids: readonly Solid[] = []) {
  const cx = x + Math.sin(yaw) * LANDING_VIEW.back + Math.cos(yaw) * LANDING_VIEW.flank;
  const cz = z + Math.cos(yaw) * LANDING_VIEW.back - Math.sin(yaw) * LANDING_VIEW.flank;
  const dx = cx - x, dz = cz - z, L2 = dx * dx + dz * dz;
  const near = (px: number, pz: number) => { const k = Math.max(0, Math.min(1, ((px - x) * dx + (pz - z) * dz) / L2)); return [Math.hypot(px - (x + k * dx), pz - (z + k * dz)), k]; };
  for (const t of trees) if (near(t.x, t.z)[0] < LANDING_VIEW.clear(t.r)) return true;
  for (const s of solids) for (let i = -4; i <= 4; i++) { // a log is sampled along its axis (9 points); a rock is one point
    if (i !== 0 && s.hx === 0 && s.hz === 0) continue;
    const [d, k] = near(s.x + s.hx * i / 4, s.z + s.hz * i / 4);
    if (d < s.r + LANDING_VIEW.pad && s.top > LANDING_VIEW.aim + k * (LANDING_VIEW.eye - LANDING_VIEW.aim)) return true; }
  return false;
}
const blockedAt = (x: number, z: number, yaw: number) => viewBlocked(x, z, yaw, treesAround(x, z), solidsAround(x, z));
/** The nearest spot (rings of step m out to maxShift) that is dry and has a clear camera-wolf line; the heading is kept. */
export function* clearViewSteps(s: { x: number; z: number }, yaw: number, dry: (x: number, z: number) => boolean): Generator<void, { x: number; z: number }> {
  if (!blockedAt(s.x, s.z, yaw)) return s;
  for (let r = LANDING_VIEW.step; r <= LANDING_VIEW.maxShift; r += LANDING_VIEW.step) { const k = Math.max(8, Math.round(2 * Math.PI * r / LANDING_VIEW.step));
    for (let i = 0; i < k; i++) { const a = i / k * 2 * Math.PI, x = Math.round((s.x + Math.cos(a) * r) * 10) / 10, z = Math.round((s.z + Math.sin(a) * r) * 10) / 10;
      if (!blockedAt(x, z, yaw) && dry(x, z)) return { x, z }; }
    yield; }
  return s;
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
