/**
 * Hydrosphere budget of one globe cell (T-0058). Pure function of (seed, day, hour, direction):
 * nothing stored, no spin-up, same shape as climate().
 *
 * The monthly shape is Kenora's one normal table (monthValue). The annual mean is moved to the cell with the
 * existing North 1975 zonal fit (seaLevelAnnualC), and the seasonal anomaly flips south of the equator.
 * At SITE.lat and sea level the air temperature matches climate(). Evaporation is surfaceBalance
 * (Penman–Monteith). The bucket is bucketStep (Manabe 1969). Snow melt uses HYDRO.ddf (Hock 2003).
 * Humidity is qsat (Bolton 1980). Not a second climate table and not a zonal energy-balance model.
 */
import Z from '../../../data/earth/altitude-zones.json';
import { seaLevelAnnualC, seaLevelWarmC, iceLineM } from '../altitudeZones';
import { AIR, HYDRO, HYDRO_SEED_FILL, MONTH_DAYS, NORMALS, SITE, SURFACE, bucketStep, climate, monthValue, qsat, shortwave, solar, surfaceBalance, type SurfaceKind } from '../weather';
import { gravity } from '../../proc/physics';
import { planetFor, toLatLon, vegetationWeight, type Surface, type Vec3 } from '../../world/globe/planet';

const DEG = 180 / Math.PI;
const ANNUAL_T = NORMALS.temp.reduce((a, b) => a + b, 0) / NORMALS.temp.length;
/** Freezing point of standard seawater (S = 35 psu) at the surface, °C.
 *  UNESCO EOS-80 (Fofonoff & Millard 1983, UNESCO tech. pap. mar. sci. 44), the Millero (1978) polynomial. */
export const SEA_FREEZE_C = seaFreeze(35);
function seaFreeze(S: number) { return -0.0575 * S + 1.710523e-3 * S ** 1.5 - 2.154996e-4 * S * S; }
/** Precipitable-water scale height, m (Wallace & Hobbs 2006, ch. 3, water-vapour scale height ~2 km) [verify]. */
export const VAPOUR_SCALE_M = 2000;
/** Below this canopy weight the land row is moss, not forest. The colour is already mostly tundra, rock or bog.
 *  Game calibration of the kind switch. */
export const CANOPY = 0.35;

export function localHour(hour: number, lonDeg: number) {
  const h = hour + (lonDeg - SITE.lon) / 15;
  return ((h % 24) + 24) % 24;
}
export function cellWater(kind: Surface['kind'], h: number, level: number) {
  return kind === 'ocean' || kind === 'lake' || h < level;
}
/** Metres of the surface the air sits on. Ocean is sea level. A lake uses its water plane. */
export function surfaceElev(s: Surface) {
  if (s.kind === 'ocean' || s.h < 0) return 0;
  if (s.kind === 'lake') return Math.max(0, s.water);
  return Math.max(0, s.h);
}

export interface CellAir { tC: number; tMonth: number; rh: number; p: number; wind: number; q: number }
/** Kenora column moved to this latitude. Monthly anomaly stays NORMALS. Diurnal and synoptic terms stay on the anomaly.
 *  Southern latitudes flip the anomaly. Elevation cools at AIR.lapse. Pressure is the hydrostatic term at this elevation
 *  (the same expression as climate, without stacking SITE.elevation on a cell that is not Kenora). */
export function cellAir(day: number, hour: number, latDeg: number, lonDeg: number, elevM: number): CellAir {
  const clim = climate(day, localHour(hour, lonDeg), 0);
  const monthT = monthValue(NORMALS.temp, day);
  const anomaly = clim.tC - monthT;
  const ampK = Z.seasonal_half_range_pole_K * Math.abs(Math.sin(SITE.lat * Math.PI / 180));
  const shape = ampK > 0 ? (monthT - ANNUAL_T) / ampK : 0;
  const amp = Z.seasonal_half_range_pole_K * Math.abs(Math.sin(latDeg * Math.PI / 180));
  const elev = Math.max(0, elevM);
  const tMonth = seaLevelAnnualC(latDeg) + (latDeg >= 0 ? 1 : -1) * shape * amp + (ANNUAL_T - seaLevelAnnualC(SITE.lat)) - AIR.lapse * elev;
  const tC = tMonth + anomaly;
  const p = AIR.p0 * Math.exp(-gravity() * elev / (AIR.Rd * (tC + 273.15)));
  const rh = Math.min(1, clim.rh);
  return { tC, tMonth, rh, p, wind: Math.hypot(clim.u, clim.v), q: rh * qsat(tC, p) };
}

export interface HydrosphereBudget {
  evaporation: number; precipitation: number; soilMm: number; runoffMmDay: number;
  sstC: number; ice: number; humidityColumn: number; snow: number;
  meltMmDay: number; tC: number; tMonth: number; kind: SurfaceKind;
}

function precipDay(day: number, latDeg: number) { return latDeg >= 0 ? day : day + 365.25 / 2; }

/** Budget from a known surface. `veg` is vegetationWeight. Snow and ice and soil are the monthly seed (no hour flicker).
 *  Evaporation is the hour asked for. */
export function hydrosphereFrom(day: number, hour: number, latDeg: number, lonDeg: number, elevM: number, water: boolean, veg: number): HydrosphereBudget {
  const air = cellAir(day, hour, latDeg, lonDeg, water ? 0 : elevM);
  const month = cellAir(day, 15, latDeg, lonDeg, water ? 0 : elevM);
  const snow = !water && (elevM >= iceLineM(latDeg) || month.tMonth <= 0) ? 1 : 0;
  const kind: SurfaceKind = water ? 'water' : snow >= 1 ? 'snow' : veg >= CANOPY ? 'forest' : 'moss';
  const ice = water && (seaLevelWarmC(latDeg) <= 0 || month.tMonth <= SEA_FREEZE_C) ? 1 : 0;
  const precip = monthValue(NORMALS.precip, precipDay(day, latDeg)) / MONTH_DAYS;
  const rain = month.tMonth > 0 && !water ? precip : 0;
  // Noon at this longitude (hour angle ~0). The bucket equilibrium uses that sun, so the seeded soil does not
  // fill and empty as the clock crosses midnight. Evaporation below still uses the hour asked for.
  const sunNoon = solar(day, 12 - lonDeg / 15 + SITE.tz, latDeg, lonDeg, SITE.tz);
  const S0n = sunNoon.cosZ > 1e-9 ? sunNoon.toa / sunNoon.cosZ : AIR.S0;
  const swNoon = shortwave(sunNoon.cosZ, 0, S0n);
  const sun = solar(day, hour, latDeg, lonDeg, SITE.tz);
  const S0r = sun.cosZ > 1e-9 ? sun.toa / sun.cosZ : AIR.S0;
  const sw = shortwave(sun.cosZ, 0, S0r);
  let soilMm: number, runoffMmDay: number;
  if (water) { soilMm = HYDRO.bucketMm; runoffMmDay = 0; }
  else if (month.tMonth <= 0 || snow === 1) { soilMm = HYDRO.bucketMm * HYDRO_SEED_FILL; runoffMmDay = 0; }
  else {
    const pot = surfaceBalance(kind, swNoon, month.tMonth, month.q, month.p, month.wind, 0, 1);
    const ePot = pot.E * 86400;
    if (!(ePot > 0) || rain >= ePot) { const held = bucketStep(HYDRO.bucketMm, Math.max(0, rain - Math.max(0, ePot))); soilMm = held.soil; runoffMmDay = held.runoff; }
    else { soilMm = HYDRO.bucketMm * (rain / ePot); runoffMmDay = 0; }
  }
  const beta = water ? 1 : Math.min(1, soilMm / HYDRO.bucketMm);
  const evap = surfaceBalance(kind, sw, air.tC, air.q, air.p, air.wind, 0, beta).E;
  const qCol = month.rh * qsat(month.tMonth, month.p);
  return {
    evaporation: evap, precipitation: precip, soilMm, runoffMmDay,
    sstC: month.tMonth, ice, humidityColumn: qCol * month.p / (AIR.Rd * (month.tMonth + 273.15)) * VAPOUR_SCALE_M,
    snow, meltMmDay: Math.max(0, month.tMonth) * HYDRO.ddf, tC: air.tC, tMonth: month.tMonth, kind,
  };
}

/** One cell. Copies nothing from the planet cache beyond this call. */
export function hydrosphereBudget(seed: number, day: number, hour: number, dir: Vec3): HydrosphereBudget {
  const s = planetFor(seed).sampleSurface([dir[0], dir[1], dir[2]]);
  const ll = toLatLon(dir);
  return hydrosphereFrom(day, hour, ll.lat * DEG, ll.lon * DEG, surfaceElev(s), cellWater(s.kind, s.h, s.level), vegetationWeight(s, dir));
}
