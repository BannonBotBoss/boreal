/**
 * Atmosphere budget of one globe cell (T-0059, issue #43). Pure function of (seed, day, hour, direction): nothing stored,
 * no spin-up, same rule as climate() and hydrosphereBudget(). The column is cellAir (T-0058): Kenora's normals moved to
 * the cell's latitude, so no second climate table and no new gas constant.
 *
 * Pressure is hydrostatic (hypsometric) at REF_Z above sea level from the cell's own column temperature, so warm columns
 * stand taller and the pressure aloft is higher there (thermal wind). Wind is geostrophic, Vg = |∇p| / (ρ f) with
 * f = 2 Ω sin φ (Holton 2004, §3.2), ∇p from neighbouring cells of this same function. Near the equator f → 0 and the
 * wind stays climate()'s seeded synoptic vector (the existing guard, not a division by zero).
 * Cloud: the air at REF_Z is colder than the surface and holds the surface vapour thinned by its scale height; where that
 * brings it to its dew point it condenses. Cloud fraction is Sundqvist et al. (1989) on that relative humidity; the base
 * is the surface air's lifting condensation level. Vertical instability is convectiveAdjust's own test
 * (potential temperature decreasing with height, Manabe & Strickler 1964) between the surface and REF_Z.
 * Not a fluid solver: the near field stays Stam (1999) + Kessler (1969) in weather.ts.
 */
import { AIR, climate, qsat, theta, unstablePair } from '../weather';
import { gravity } from '../../proc/physics';
import { planetFor, toLatLon, type Vec3 } from '../../world/globe/planet';
import { VAPOUR_SCALE_M, cellAir, localHour, surfaceElev } from './hydrosphereBudget';

const DEG = 180 / Math.PI, RAD = Math.PI / 180;
/** Reference level, m: the 850 hPa standard height (ISO 2533: ~1457 m) [rounded]. */
export const REF_Z = 1500;
/** Earth mean radius, m (IUGG). */
const RE = 6371e3;
/** Geostrophic balance fails near the equator (f → 0; Holton 2004, §3.2): inside this latitude the synoptic vector is kept. */
export const GEO_MIN_LAT = 5;
/** Neighbour step for ∇p, degrees. */
export const GRAD_DEG = 2;
/** Sundqvist et al. (1989, Mon. Wea. Rev. 117:1641) critical relative humidity for stratiform cloud [verify: 0.75–0.85 in GCMs]. */
export const RH_CRIT = 0.8;
/** Optical depth of a full cover: τ = 3 LWP / (2 ρw re) (Stephens 1978, J. Atmos. Sci. 35:2123), with a typical stratiform
 *  LWP 0.1 kg/m² and re 10 µm [verify: typical values, not a cloud-microphysics model]. */
export const CLOUD_OPTICS = { lwp: 0.1, re: 10e-6, rhoW: 1000 };
const TAU_FULL = 3 * CLOUD_OPTICS.lwp / (2 * CLOUD_OPTICS.rhoW * CLOUD_OPTICS.re);

export const coriolis = (latDeg: number) => 2 * AIR.omega * Math.sin(latDeg * RAD);

/** Geostrophic wind (u east, v north), m/s, from ∂p/∂x east and ∂p/∂y north (Pa/m) and density; null inside GEO_MIN_LAT. */
export function geostrophicWind(dpdx: number, dpdy: number, rho: number, latDeg: number): { u: number; v: number } | null {
  if (Math.abs(latDeg) < GEO_MIN_LAT) return null;
  const f = coriolis(latDeg);
  return { u: -dpdy / (rho * f), v: dpdx / (rho * f) };
}

/** Sundqvist (1989): 0 below RH_CRIT, 1 at saturation. */
export function cloudFraction(rh: number) {
  if (rh <= RH_CRIT) return 0;
  return 1 - Math.sqrt(Math.max(0, 1 - Math.min(1, rh)) / (1 - RH_CRIT));
}

/** Column at REF_Z: hypsometric pressure with the layer-mean temperature, the lifted parcel's relative humidity. */
export function refLevel(day: number, hour: number, latDeg: number, lonDeg: number) {
  const sea = cellAir(day, hour, latDeg, lonDeg, 0);
  const tRef = sea.tMonth - AIR.lapse * REF_Z; // climatological column (no diurnal term aloft)
  const tMean = sea.tC - AIR.lapse * REF_Z / 2 + 273.15;
  const p = AIR.p0 * Math.exp(-gravity() * REF_Z / (AIR.Rd * tMean));
  const rho = p / (AIR.Rd * (tRef + 273.15));
  // vapour aloft decays with the precipitable-water scale height (T-0058's VAPOUR_SCALE_M); where that air has cooled to
  // its dew point (rh -> 1) it condenses
  return { sea, tRef, p, rho, rh: Math.min(1, sea.q * Math.exp(-REF_Z / VAPOUR_SCALE_M) / qsat(tRef, p)) };
}

export interface AtmosphereBudget {
  /** hydrostatic pressure at REF_Z, Pa */ pressure: number;
  /** surface pressure at the cell's elevation, Pa */ surfaceP: number;
  /** wind at REF_Z, m/s (east, north); geostrophic unless `synoptic` */ u: number; v: number; synoptic: boolean;
  /** 0..1 */ cloudFraction: number; opticalDepth: number;
  /** lifting condensation level above the surface, m (Espy: 125 m per K of dew-point depression) */ cloudBaseM: number;
  /** θ(surface) − θ(REF_Z), K: > 0 is statically unstable */ instabilityK: number; unstable: boolean;
}

/** Budget from a known latitude, longitude (degrees) and surface elevation (m). */
export function atmosphereFrom(day: number, hour: number, latDeg: number, lonDeg: number, elevM: number): AtmosphereBudget {
  const c = refLevel(day, hour, latDeg, lonDeg);
  const at = (la: number, lo: number) => refLevel(day, hour, Math.max(-89.9, Math.min(89.9, la)), lo).p;
  const coslat = Math.max(0.02, Math.cos(latDeg * RAD)), d = GRAD_DEG * RAD * RE;
  const dpdx = (at(latDeg, lonDeg + GRAD_DEG) - at(latDeg, lonDeg - GRAD_DEG)) / (2 * d * coslat);
  const dpdy = (at(latDeg + GRAD_DEG, lonDeg) - at(latDeg - GRAD_DEG, lonDeg)) / (2 * d);
  const g = geostrophicWind(dpdx, dpdy, c.rho, latDeg);
  const syn = climate(day, localHour(hour, lonDeg), REF_Z);
  const sfc = cellAir(day, hour, latDeg, lonDeg, elevM);
  const cf = cloudFraction(c.rh);
  // dew point of the surface air (Bolton 1980 inversion of es), then Espy's LCL
  const e = sfc.q * sfc.p / (0.622 + 0.378 * sfc.q), lnr = Math.log(Math.max(1e-6, e) / 611.2);
  const td = 243.5 * lnr / (17.67 - lnr);
  const thS = theta(sfc.tC, sfc.p), thR = theta(c.tRef, c.p);
  return { pressure: c.p, surfaceP: sfc.p, u: g ? g.u : syn.u, v: g ? g.v : syn.v, synoptic: !g,
    cloudFraction: cf, opticalDepth: cf * TAU_FULL, cloudBaseM: Math.max(0, 125 * (sfc.tC - td)),
    instabilityK: thS - thR, unstable: unstablePair(thS, thR) };
}

export function atmosphereBudget(seed: number, day: number, hour: number, dir: Vec3): AtmosphereBudget {
  const s = planetFor(seed).sampleSurface([dir[0], dir[1], dir[2]]);
  const ll = toLatLon(dir);
  return atmosphereFrom(day, hour, ll.lat * DEG, ll.lon * DEG, surfaceElev(s));
}

/** Cloud fraction only, for the globe shell bake: rows south → north, columns lon −180..180, as planetLayers. */
export function cloudGrid(day: number, hour: number, nlat: number): Float32Array {
  const nlon = nlat * 2, out = new Float32Array(nlat * nlon);
  for (let r = 0; r < nlat; r++) { const lat = -90 + (r + .5) * 180 / nlat;
    for (let c = 0; c < nlon; c++) out[r * nlon + c] = cloudFraction(refLevel(day, hour, lat, -180 + (c + .5) * 360 / nlon).rh); }
  return out;
}
