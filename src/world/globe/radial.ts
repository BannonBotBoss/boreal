/**
 * Radial frame and altitude: the single source (Grok Bot, T-0070 stage 2; Matthew: "the distance from its core outwards, should be an axis",
 * "any direction outward is a vector", "so this way, we can have altitude").
 * Every point is r·û about the body's centre (0). Altitude h = r − R_surface(û), where R_surface is the hydrostatic figure (figure.ts)
 * plus terrain, or the sea surface over water. hSea is above the figure (sea level); hMean is above the IUGG mean radius. Negative h is depth.
 * Camera height, ground clamp and the axis readout all call altitudeAt / surfaceRadius; nothing else computes altitude.
 */
import { figureRadius } from './figure';
import { fromLatLon, type Vec3 } from './planet';
import { K } from '../../core/constants';

interface Surf { sampleSurface(d: Vec3, fp?: number): { h: number; water: number } }
/** Radius (m) of the solid or liquid surface along unit û: figure + max(terrain, water surface). */
export function surfaceRadius(planet: Surf, u: Vec3): number { const s = planet.sampleSurface(u); return figureRadius(u) + Math.max(s.h, s.water); }
/** Altitudes (m) of a point at radius r (m) along û. */
export function altitudeAt(planet: Surf, r: number, u: Vec3) { return { h: r - surfaceRadius(planet, u), hSea: r - figureRadius(u), hMean: r - K.R_earth_mean }; }
/** Radius (m) for a wanted altitude h above the surface along û (inverse of altitudeAt.h). */
export function radiusFor(planet: Surf, h: number, u: Vec3): number { return surfaceRadius(planet, u) + h; }

/** Axis direction from a URL value: "lat,lon" (degrees), or "body:sun" (needs the sun direction). Three numbers stay the old camera ?dir. */
export function parseAxisDir(v: string | null, sunDir?: () => Vec3): Vec3 | null {
  if (!v) return null; if (v === 'body:sun') return sunDir ? sunDir() : null;
  const n = v.split(',').map(Number); if (n.length !== 2 || !n.every(Number.isFinite)) return null;
  return fromLatLon(n[0] * Math.PI / 180, n[1] * Math.PI / 180);
}
/** Signed axis coordinate (km): from the centre at 0 to ±surface and beyond. A negative r is the antipode side, so the point is |r|·(−û). */
export function axisPoint(u: Vec3, rKm: number): Vec3 { const r = rKm * 1000; return [u[0] * r, u[1] * r, u[2] * r]; }
