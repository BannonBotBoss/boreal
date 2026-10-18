/**
 * Globe → game handoff (Grok Bot). Descending below HANDOFF.alt over the playable home region hands the player to the
 * game at the same spot, through the game's existing `?at=x,z` spawn (main.ts). No edits to main.ts: the game reloads
 * with that query. Heading and the return trip (game → globe on ascent) need main.ts hooks: requested in AGENT-NOTES.md.
 */
import { PLANET } from './planet';

export const HANDOFF = { alt: 2000, margin: 250, hintAlt: 6000 }; // metres above ground; keep-out from the region edge [game calibration]

/** Game-local spawn (x, z) when the camera at `alt` over a sample with home weight `home` and local (x, z) should hand
 *  off; null otherwise. Only fully inside the region (home weight 1, `margin` from the edge) and while not climbing. */
export function handoffTarget(s: { home: number; x: number; z: number }, alt: number, climbing: boolean) {
  const lim = PLANET.home.halfSize - PLANET.home.feather - HANDOFF.margin;
  if (climbing || alt > HANDOFF.alt || s.home < 1 || Math.abs(s.x) > lim || Math.abs(s.z) > lim) return null;
  return { x: Math.round(s.x * 10) / 10, z: Math.round(s.z * 10) / 10 };
}
/** The game URL for a spawn: the current query minus the globe's own keys, plus `at`. */
export function gameUrl(search: string, at: { x: number; z: number } | null) {
  const q = new URLSearchParams(search);
  for (const k of ['view', 'alt', 'shot', 'bench', 'workers', 'handoff']) q.delete(k);
  if (at) q.set('at', `${at.x},${at.z}`); else q.delete('at');
  const s = q.toString(); return s ? `?${s}` : '?';
}
