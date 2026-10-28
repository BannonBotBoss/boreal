/**
 * Anchor the existing forest frame on a globe click (issue #156, bridge).
 *
 * Inside the home square the click keeps game x,z and the Kenora height.
 * Outside it, sampleSurface used to write x = z = 0, and the drone woke up
 * on the wolf's lake. The click's direction becomes the local origin. Height
 * is the planet function the tiles already sample, written as metres around
 * the forest's water plane. Weather and the tree line read the same direction.
 */
import { hash } from '../../proc/rng';
import { LEVEL } from '../../core/tuning';
import { surfaceDetail } from '../../core/surface';
import { WORLD_SEED } from '../../core/world';
import { clearSite, setSite, siteDirection, type SiteVec } from '../../core/sitePhase';
import { remoteGameHeight, setRemoteHeight } from '../../core/siteHeight';
import { PLANET, planetFor, toLatLon, type Vec3 } from './planet';

const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function tangentFrame(up: Vec3) {
  const dir = norm(up);
  const axis: Vec3 = Math.abs(dir[1]) > 0.98 ? [1, 0, 0] : [0, 1, 0];
  const east = norm(cross(axis, dir));
  const north = cross(dir, east);
  return { dir, east, north };
}

export function clearLanding() {
  clearSite();
  setRemoteHeight(null);
}

/** True when the click is outside the home square and the forest origin moved. */
export function engageLanding(direction: Vec3, home: number) {
  if (home > 0) { clearLanding(); return false; }
  const frame = tangentFrame(direction);
  const planet = planetFor(WORLD_SEED);
  const origin = planet.sampleSurface(frame.dir);
  const ll = toLatLon(frame.dir);
  const latDeg = ll.lat * 180 / Math.PI;
  const lonDeg = ll.lon * 180 / Math.PI;
  const salt = hash(`landing:${latDeg.toFixed(3)}:${lonDeg.toFixed(3)}`);
  setSite({ latDeg, lonDeg, datumM: Math.max(0, origin.h), salt, dir: frame.dir, east: frame.east, north: frame.north });
  setRemoteHeight((x, z) => {
    const d = siteDirection(x, z, PLANET.radius);
    const s = planet.sampleSurface(d);
    if (s.kind === 'ocean' || s.h < 0) return LEVEL.waterSurface - 2;
    if (s.kind === 'lake') return LEVEL.waterSurface - 0.35;
    return LEVEL.waterSurface + (s.h - origin.h) + surfaceDetail(x, z) * 0.5;
  });
  return true;
}

/** Nearest dry ground in the anchored frame. The Kenora dry-start is not used off home. */
export function dryNear(step = 40, maxR = 1600): { x: number; z: number } {
  const dry = (x: number, z: number) => (remoteGameHeight(x, z) ?? -10) >= LEVEL.shore;
  if (dry(0, 0)) return { x: 0, z: 0 };
  for (let r = step; r <= maxR; r += step) {
    const k = Math.max(8, Math.round(2 * Math.PI * r / step));
    for (let i = 0; i < k; i++) {
      const a = i / k * Math.PI * 2;
      const x = Math.round(Math.cos(a) * r * 10) / 10;
      const z = Math.round(Math.sin(a) * r * 10) / 10;
      if (dry(x, z)) return { x, z };
    }
  }
  return { x: 0, z: 0 };
}

export type { SiteVec };
