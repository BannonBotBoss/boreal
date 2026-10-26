/**
 * Instantaneous solar budget of one globe cell (T-0057). Pure function of (seed, day, hour, direction):
 * nothing stored, no spin-up, same shape as climate().
 *
 * Zenith and top-of-atmosphere insolation are NOAA / Spencer 1971 via weather.solar(), at this direction's
 * latitude and longitude (Kenora's timezone, so a cell at PLANET.home.latDeg and SITE.lon matches solar()
 * called with that latitude). Cloud fraction is T-0059's (atmosphereBudget: Sundqvist on the 1500 m dew-point humidity)
 * unless the caller passes a number (the unit tests pass 0). Albedo is the
 * existing surface: SURFACE.water.albedo on ocean and lakes, and the linear land colour from surfaceColour
 * (Rec. 709 luminance) on land. Absorbed and reflected split shortwave() (Meinel & Meinel, Kasten & Czeplak).
 * Outgoing longwave is columnLongwave, the upward term already inside surfaceBalance. Not Berger 1978.
 * Not a zonal Budyko–Sellers model: the temperature and humidity are the Kenora column from climate().
 */
import { AIR, SITE, SURFACE, climate, columnLongwave, qsat, shortwave, solar } from '../weather';
import { cloudFraction, refLevel } from './atmosphereBudget';
import { PLANET, fromLatLon, planetFor, surfaceColour, toLatLon, type Vec3 } from '../../world/globe/planet';

const DEG = 180 / Math.PI;
/** Broadband albedo of a linear sRGB land colour (the globe vertex colours are linear albedo). */
export const landAlbedo = (rgb: ArrayLike<number>, i = 0) => 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];

export interface SolarBudget {
  zenith: number; cosZ: number; toa: number; albedo: number;
  absorbed: number; reflected: number; outgoing: number;
}

/** T-0059's cloud fraction over a direction: the same value atmosphereBudget() reports for that cell. */
export function cellCloud(day: number, hour: number, dir: Vec3) {
  const ll = toLatLon(dir);
  return cloudFraction(refLevel(day, hour, ll.lat * DEG, ll.lon * DEG).rh);
}

/** `null` cloud means the cell's own cover from T-0059; a number overrides it. */
export type CloudArg = number | null;

/** Budget from a known albedo. `solar()` supplies zenith and TOA; shortwave uses the same Earth–Sun distance. */
export function budgetFromAlbedo(day: number, hour: number, dir: Vec3, albedo: number, cloudIn: CloudArg = 0): SolarBudget {
  const ll = toLatLon(dir);
  const cloud = cloudIn ?? cellCloud(day, hour, dir);
  const sun = solar(day, hour, ll.lat * DEG, ll.lon * DEG, SITE.tz);
  const S0r = sun.cosZ > 1e-9 ? sun.toa / sun.cosZ : AIR.S0;
  const sw = shortwave(sun.cosZ, cloud, S0r);
  const col = climate(day, hour, 0), q = col.rh * qsat(col.tC, col.p);
  return {
    zenith: sun.zenith, cosZ: sun.cosZ, toa: sun.toa, albedo,
    absorbed: (1 - albedo) * sw, reflected: albedo * sw, outgoing: columnLongwave(col.tC, q, col.p, cloud).up,
  };
}

/** Albedo at a unit direction: water from SURFACE, land from sampleSurface + surfaceColour. Copies the sample;
 *  sampleSurface reuses one object. */
export function albedoAt(seed: number, dir: Vec3) {
  const s = planetFor(seed).sampleSurface([dir[0], dir[1], dir[2]]);
  const water = s.kind === 'ocean' || s.kind === 'lake' || s.h < s.level;
  if (water) return SURFACE.water.albedo;
  return landAlbedo(surfaceColour({ ...s, soilW: s.soilW.slice() }, dir));
}

/** One cell. `cloud` null takes T-0059's cover; the unit tests pass 0. */
export function solarBudget(seed: number, day: number, hour: number, dir: Vec3, cloud: CloudArg = 0): SolarBudget {
  return budgetFromAlbedo(day, hour, dir, albedoAt(seed, dir), cloud);
}

/** Q_absorbed (W/m²) for a tile's vertices. Position is relative to `centre` (tile.ts). Shore field < 0 is water. */
export function absorbedAttribute(position: ArrayLike<number>, color: ArrayLike<number>, height: ArrayLike<number>, centre: Vec3, day: number, hour: number, cloud: CloudArg = 0) {
  const out = new Float32Array(height.length);
  for (let i = 0; i < height.length; i++) {
    const x = position[i * 3] + centre[0], y = position[i * 3 + 1] + centre[1], z = position[i * 3 + 2] + centre[2];
    const l = Math.hypot(x, y, z) || 1;
    const albedo = height[i] < 0 ? SURFACE.water.albedo : landAlbedo(color, i * 3);
    out[i] = budgetFromAlbedo(day, hour, [x / l, y / l, z / l], albedo, cloud).absorbed;
  }
  return out;
}

/** Direction at the home latitude and Kenora's longitude: the known-match cell for solar(). */
export function homeBudgetDirection(): Vec3 {
  return fromLatLon(PLANET.home.latDeg * Math.PI / 180, SITE.lon * Math.PI / 180);
}
