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
import { elevationWins, groundForCover, sampleDem, samplePhotoVegetation } from './openTiles';
import { coverKind, coverTreeShare, type CoverKind } from './coverKind';
import { vegetationWeight } from './planet';
import { liveCoastM } from '../../core/planetWeather';

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
  const planet = planetFor(WORLD_SEED, undefined, '', true);
  // sampleSurface reuses one result object, so keep the number: the reader below samples again and would
  // otherwise read its own sample back as the origin (s.h - origin.h = 0, a flat landing patch).
  // On a lake the datum is the lake's surface, not its bed: the game's water plane (LEVEL.waterSurface) is that surface,
  // so shore land sits at the water line instead of a lake-depth above it.
  const o = planet.sampleSurface(frame.dir);
  const originH = o.kind === 'lake' ? o.water : o.h;
  const ll = toLatLon(frame.dir);
  const latDeg = ll.lat * 180 / Math.PI;
  const lonDeg = ll.lon * 180 / Math.PI;
  const salt = hash(`landing:${latDeg.toFixed(3)}:${lonDeg.toFixed(3)}`);
  // Ocean keeps the aim (landingShore: no dry cell is open water, not a shore we invent) and stands on the sea
  // surface. A null cover used to leave treeShare at 1, which planted a closed stand on that sea.
  const ocean = o.kind === 'ocean' || o.h < 0;
  const cover = ocean ? null : landingCover(planet, latDeg, lonDeg, frame.dir);
  const coastM = liveCoastM(latDeg, lonDeg);
  setSite({ latDeg, lonDeg, datumM: Math.max(0, originH), salt, dir: frame.dir, east: frame.east, north: frame.north, treeShare: ocean ? 0 : (cover == null ? 1 : coverTreeShare(cover)), coastM });
  setRemoteHeight((x, z) => {
    const d = siteDirection(x, z, PLANET.radius);
    const s = planet.sampleSurface(d);
    const ll = toLatLon(d);
    const dem = sampleDem(ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI);
    if (elevationWins(s.kind, dem)) return LEVEL.waterSurface + (dem! - originH) + surfaceDetail(x, z) * 0.5;
    if (s.kind === 'ocean' || s.h < 0) return LEVEL.waterSurface - 2;
    if (s.kind === 'lake') return LEVEL.waterSurface - 0.35;
    return LEVEL.waterSurface + (s.h - originH) + surfaceDetail(x, z) * 0.5;
  });
  return true;
}

/** Cover class at the landing origin, the same inputs as the landing report (render/landingCast groundAt): DEM height and
 *  land win over the seeded planet, a cached photo's vegetation wins, live coast distance moves the tree line. A water
 *  origin returns null: its vegetation weight is 0 and would read as desert, so the stand is left as it was (share 1). */
export function landingCover(planet: ReturnType<typeof planetFor>, latDeg: number, lonDeg: number, dir: Vec3): CoverKind | null {
  const s = planet.sampleSurface(dir);
  const { elevM, water } = groundForCover(s, sampleDem(latDeg, lonDeg));
  if (water) return null;
  const coastM = liveCoastM(latDeg, lonDeg);
  const vegetation = samplePhotoVegetation(latDeg, lonDeg) ?? vegetationWeight(s, dir, coastM);
  return coverKind(latDeg, elevM, vegetation, false, coastM);
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
