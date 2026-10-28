/**
 * Atmosphere + hydrosphere (Grok Bot). PROJECT-RULES rules 5, 7, 8: established models, real values, math-only far field.
 *  - Far field (everything outside the grid) is the planet climate when that grid is bound, and otherwise station
 *    normals + the ISA lapse rate + a seeded synoptic wind. Nothing stored. The near grid is seeded from the same target.
 *  - Near field: a coarse 3-D cell grid centred on the viewer (core/interest), stepped at a low rate.
 *    Left alone, the cell relaxes toward the planet climate (`cellClimate`), not the private Kenora formula.
 *    The step is the one already here:
 *    surface energy balance (net shortwave/longwave, Penman–Monteith ET, sensible heat as the residual),
 *    Boussinesq buoyancy, Coriolis, log-law drag over the canopy, Stam (1999) Stable Fluids semi-Lagrangian
 *    advection + Jacobi pressure projection, Kessler (1969) warm-rain microphysics with snow below 0 °C,
 *    and a bucket hydrology (Manabe 1969) per surface column that feeds core/ground.ts (moisture, snowpack).
 *  - ONE wind field: `windAt(x, y, z)` is sampled by trees, grass, fur, water, particles, sound and physics drag.
 * Every constant cites its source; [verify] = from memory, still to be checked against the original.
 */
import { K } from './constants';
import { hash, random } from '../proc/rng';
import { f } from '../proc/trace';
import { gravity } from '../proc/physics';
import { WORLD_SEED, heightAt } from './world';
import { LEVEL } from './tuning';
import { INTEREST } from './interest';

// ---- constants ---------------------------------------------------------------------------------------------------
export const AIR = {
  get S0() { return K.TSI; },  // total solar irradiance, W/m² (core/constants: IAU 2015 nominal; Kopp & Lean 2011)
  get sigma() { return K.sigma; }, // Stefan–Boltzmann, derived 2π⁵k⁴/(15h³c²) in core/constants
  cp: 1004,            // specific heat of dry air at constant pressure, J/kg/K (Wallace & Hobbs 2006, Atmospheric Science, 2nd ed.)
  Rd: 287.05,          // gas constant dry air, J/kg/K (Wallace & Hobbs 2006)
  Rv: 461.5,           // gas constant water vapour, J/kg/K (Wallace & Hobbs 2006)
  Lv: 2.501e6,         // latent heat of vaporisation at 0 °C, J/kg (Wallace & Hobbs 2006)
  p0: 101325,          // sea-level standard pressure, Pa (ISO 2533:1975 standard atmosphere)
  lapse: .0065,        // environmental lapse rate, K/m (ICAO/ISO 2533 standard atmosphere)
  kappa: .41,          // von Kármán constant (Högström 1996, Bound.-Layer Meteor. 78:215)
  get omega() { return K.omega_earth; }, // Earth rotation rate, rad/s (core/constants, WGS84/IERS 2010)
  gamma: 66.5,         // psychrometric constant at ~100 kPa, Pa/K (Allen et al. 1998, FAO-56 Table 2.2) [verify]
};
/** Site: Kenora, Ontario (boreal Shield). Matches the ground climate in core/ground.ts. Configurable. */
export const SITE = { lat: 49.79, lon: -94.36, tz: -6, elevation: 410 }; // ECCC station Kenora A (WMO 71850) [verify coords]
/** Kenora A 1981–2010 climate normals (Environment and Climate Change Canada): monthly mean °C, mean daily range °C,
 * precipitation mm, mean RH % at 1500 LST [verify all against the ECCC table]. */
export const NORMALS = {
  temp:  [-16.0, -13.0, -5.9, 3.3, 10.9, 16.0, 19.2, 17.9, 12.1, 4.9, -3.9, -12.7],
  range: [10.4, 11.6, 11.0, 11.3, 12.3, 11.4, 10.8, 10.9, 9.9, 8.5, 7.7, 8.9],
  precip: [27, 20, 29, 34, 76, 108, 101, 76, 89, 60, 42, 27],
  rh:    [72, 66, 60, 51, 48, 56, 57, 57, 62, 67, 77, 77],
  wind: 3.6, // m/s annual mean at 10 m [verify]
};
/** Surface types: shortwave albedo (Oke 1987, Boundary Layer Climates, Table 1.1) and bulk surface resistance for ET
 * (conifer forest r_s ≈ 100 s/m: Kelliher et al. 1995, Agric. For. Meteorol. 73:1; open water 0; moss ~ 50 [verify]). */
export const SURFACE = {
  water: { albedo: .06, rs: 0, z0: .0002 },        // water, high sun .03–.10; z0 open water ~0.2 mm (Stull 1988 Fig 9.6)
  forest: { albedo: .1, rs: 100, z0: 1.5 },        // conifer .05–.15; z0 ≈ 0.1 × canopy height 15 m (Raupach 1994) [verify]
  moss: { albedo: .15, rs: 50, z0: .03 },          // tundra/moss .18–.25 → low end for wet boreal moss [verify]
  snow: { albedo: .8, rs: 0, z0: .001 },           // fresh snow .80–.95, old .40–.70 (Oke 1987)
};
export const HYDRO = {
  bucketMm: 150,   // field capacity of the bucket (Manabe 1969, Mon. Weather Rev. 97:739)
  snowDensity: 250, // settled seasonal snow, kg/m³ (Sturm et al. 2010, J. Hydrometeorol. 11:1380) [verify]
  ddf: 3,          // degree-day melt factor, mm w.e./°C/day (Hock 2003, J. Hydrol. 282:104, forest snow 1.5–5) [verify]
};
/** Snow depth in centimetres from the snow-water store.
 *  Sturm et al. 2010 eq. 1: SWE = depth × density / density of water, so depth = SWE / density.
 *  `sweMm` is kg/m² (1 mm of water over 1 m² is 1 kg). Dividing by `HYDRO.snowDensity` (kg/m³) gives metres.
 *  Centimetres are that length × 100. There is no separate depth constant. */
export function snowDepthCm(sweMm: number) {
  return sweMm / HYDRO.snowDensity * 100;
}
/** New precipitation below 0 °C is snow. At and above 0 °C it is rain (issue #100). The comparison is the one the Kessler step already used. */
export function precipFallsAsSnow(tC: number) {
  return tC < 0;
}
/** Initial bucket fill as a fraction of field capacity. The near grid is seeded here; a frozen planet cell holds the same fill
 *  instead of draining. Game calibration (not a measured wilting point). */
export const HYDRO_SEED_FILL = 0.6;
/** Mean month length (days) that places a day-of-year in the 12-value normals. 365.25/12 rounded to the value this file already used. */
export const MONTH_DAYS = 30.44;
/** Interpolate a 12-month normal to a day of the year (the same weights `climate` uses). */
export function monthValue(table: number[], day: number) {
  const m = (day - 15) / MONTH_DAYS, i = Math.floor(m), t = m - i;
  return table[(i % 12 + 12) % 12] * (1 - t) + table[((i + 1) % 12 + 12) % 12] * t;
}
/** One Manabe (1969) bucket step. `addMm` is rain plus melt; `evapMm` is removed. Soil stays inside 0..field capacity;
 *  everything above field capacity is runoff. */
export function bucketStep(soilMm: number, addMm: number, evapMm = 0) {
  const w = soilMm + addMm - evapMm;
  return { soil: Math.min(HYDRO.bucketMm, Math.max(0, w)), runoff: Math.max(0, w - HYDRO.bucketMm) };
}
export const KESSLER = {
  k1: 1e-3, qc0: 1e-3, // autoconversion rate 1/s above 1 g/kg (Kessler 1969, Meteor. Monogr. 32)
  k2: 2.2,             // accretion 2.2 qc qr^0.875 (Klemp & Wilhelmson 1978, J. Atmos. Sci. 35:1070)
};
/** Liquid-water path the column already treats as cloud fraction 1. 200 g/m². [verify] */
export const CLOUD_LWP_SAT = 0.2;

// ---- solar: NOAA General Solar Position Calculations (NOAA GML, after Spencer 1971) --------------------------------
const RAD = Math.PI / 180;
export function solar(dayOfYear: number, localHour: number, lat = SITE.lat, lon = SITE.lon, tz = SITE.tz) {
  const g = 2 * Math.PI / 365 * (dayOfYear - 1 + (localHour - 12) / 24);
  const eqtime = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const tst = localHour * 60 + eqtime + 4 * lon - 60 * tz, ha = (tst / 4 - 180) * RAD, phi = lat * RAD;
  const cosZ = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const r2 = 1.000110 + .034221 * Math.cos(g) + .001280 * Math.sin(g) + .000719 * Math.cos(2 * g) + .000077 * Math.sin(2 * g); // (r0/r)² (Spencer 1971)
  return { decl: decl / RAD, eqtime, solarHour: tst / 60, zenith: Math.acos(Math.max(-1, Math.min(1, cosZ))) / RAD, cosZ, toa: Math.max(0, AIR.S0 * r2 * cosZ) };
}
/** Surface shortwave: clear-sky beam+diffuse transmittance 0.7^(AM^0.678) (Meinel & Meinel 1976, via Laue 1970) × 1.1 for diffuse,
 * Kasten & Young (1989) air mass, cloud attenuation 1 − 0.75 C^3.4 (Kasten & Czeplak 1980, Solar Energy 24:177). */
export function shortwave(cosZ: number, cloud: number, S0r = AIR.S0) {
  if (cosZ <= 0) return 0;
  const z = Math.acos(cosZ) / RAD, am = 1 / (cosZ + .50572 * (96.07995 - z) ** -1.6364);
  return 1.1 * S0r * cosZ * .7 ** (am ** .678) * (1 - .75 * cloud ** 3.4);
}
/** Saturation vapour pressure, Pa (Bolton 1980, Mon. Weather Rev. 108:1046). */
export const esat = (tC: number) => 611.2 * Math.exp(17.67 * tC / (tC + 243.5));
export const qsat = (tC: number, p: number) => .622 * esat(tC) / Math.max(1, p - .378 * esat(tC));

// ---- climatology (the far field: pure function, never stored) -----------------------------------------------------
const smooth = (key: string, t: number) => { const i = Math.floor(t), a = random(hash(`${key}:${WORLD_SEED}:${i}`))(), b = random(hash(`${key}:${WORLD_SEED}:${i + 1}`))(), u = t - i; return a + (b - a) * u * u * (3 - 2 * u); };
/** Climatological state at (day, hour, altitude): temperature from normals + diurnal cosine (min at sunrise ~05, max ~15 LST:
 * Parton & Logan 1981, Agric. Meteorol. 23:205, simplified), ISA lapse, seeded synoptic wind (~3-day weather systems). */
let memo: { key: string; v: ReturnType<typeof climateRaw> }[] = [];
let climateRawCalls = 0;
/** How many times the private Kenora formula ran. The near grid must not add to this while the planet climate is bound. */
export function climateRawCallCount() { return climateRawCalls; }
/** Memoised: callers outside the near grid ask for the same (day, hour, layer) many times per step. */
export function climate(day: number, hour: number, z = 0) {
  const key = `${day}:${hour}:${z}`; for (const m of memo) if (m.key === key) return m.v;
  const v = climateRaw(day, hour, z); memo.unshift({ key, v }); if (memo.length > 12) memo.pop(); return v;
}
function climateRaw(day: number, hour: number, z = 0) {
  climateRawCalls++;
  const t = day + hour / 24, mean = monthValue(NORMALS.temp, day), range = monthValue(NORMALS.range, day);
  const synopticT = (smooth('synT', t / 3) - .5) * 8; // ± 4 °C day-to-day anomaly [verify: Kenora daily SD ~4–5 °C]
  const tC = mean + synopticT + range / 2 * Math.cos((hour - 15) / 24 * 2 * Math.PI) - AIR.lapse * z;
  const dir = smooth('synDir', t / 3) * 4 * Math.PI, speed = NORMALS.wind * 2 * smooth('synSpd', t / 2) * (1 + z / 500) ;
  const rh = monthValue(NORMALS.rh, day) / 100 * (1 + .3 * (smooth('synRH', t / 3) - .5)) * (1 + .15 * Math.cos((hour - 4) / 24 * 2 * Math.PI));
  return { tC, u: Math.cos(dir) * speed, v: Math.sin(dir) * speed, rh: Math.min(1, rh), p: AIR.p0 * Math.exp(-gravity() * (z + SITE.elevation) / (AIR.Rd * (tC + 273.15))) };
}
/** What one near-grid cell relaxes toward. `u` is east, `v` is south (the column's axes). */
export interface CellClimate {
  tC: number; u: number; v: number; rh: number; p: number;
  /** Surface air, before the lapse. Snow uses this. */
  surfaceTC: number;
  cloud?: number; precipMmH?: number; sweMm?: number; soilMm?: number;
  source: 'planet' | 'raw';
}
/**
 * The near grid's driver. A bound planet answers with its own climate.
 * `climateRaw` runs only when that reader has no target (wasm did not load).
 */
export function cellClimate(day: number, hour: number, z: number, x = 0, zz = 0): CellClimate {
  const hit = reader?.target?.(x, zz, z);
  if (hit) return hit;
  const c = climate(day, hour, z);
  return { tC: c.tC, u: c.u, v: c.v, rh: c.rh, p: c.p, surfaceTC: c.tC + AIR.lapse * z, source: 'raw' };
}
/** Synoptic nudge toward the climate target. One hour. Temperature and humidity use a quarter of that rate, the factor already on the column. [game calibration] */
export function relaxToward(current: number, target: number, dt: number, thermo = false) {
  const relax = Math.min(1, dt / 3600);
  return current + (target - current) * relax * (thermo ? 0.25 : 1);
}

// ---- near-field grid ----------------------------------------------------------------------------------------------
/** day and hour are copies of the world clock, written by updateWeather before each step. The step integrates the dt it was given; it does not own a rate. */
export const WEATHER = { on: true, quality: 8, day: 227, hour: 8, ox: 0, oz: 0, ms: 0, msAvg: 0, steps: 0 };
export const NY = 4, DY = 400; // layer centres at 200, 600, 1000, 1400 m above the surface
export let NX = 8, DX = 48;
export interface Grid { u: Float32Array; v: Float32Array; w: Float32Array; th: Float32Array; q: Float32Array; qc: Float32Array; qr: Float32Array;
  soil: Float32Array; swe: Float32Array; runoff: Float32Array; precip: Float32Array; snowfall: Float32Array; flux: { Rn: number; H: number; LE: number; G: number; E: number }[] }
let grid: Grid;
const idx = (i: number, j: number, k: number) => (k * NX + j) * NX + i;
export const theta = (tC: number, p: number) => (tC + 273.15) * (AIR.p0 / p) ** (AIR.Rd / AIR.cp);
const tempOf = (th: number, p: number) => th * (p / AIR.p0) ** (AIR.Rd / AIR.cp) - 273.15;
const layerZ = (k: number) => (k + .5) * DY;
const cellX = (i: number) => WEATHER.ox + (i + .5 - NX / 2) * DX, cellZ = (j: number) => WEATHER.oz + (j + .5 - NX / 2) * DX;
/** Initialise (or reset) the grid from the climate target: deterministic from seed + date. */
export function initWeather(day = WEATHER.day, hour = WEATHER.hour, ox = WEATHER.ox, oz = WEATHER.oz, n = WEATHER.quality) {
  NX = n; DX = 384 / n; Object.assign(WEATHER, { day, hour, ox: Math.round(ox / DX) * DX, oz: Math.round(oz / DX) * DX });
  const N = NX * NX * NY, A = () => new Float32Array(N), S = () => new Float32Array(NX * NX);
  grid = { u: A(), v: A(), w: A(), th: A(), q: A(), qc: A(), qr: A(), soil: S().fill(HYDRO.bucketMm * HYDRO_SEED_FILL), swe: S(), runoff: S(), precip: S(), snowfall: S(), flux: [] };
  let planet = 0, total = 0;
  for (let k = 0; k < NY; k++) for (let j = 0; j < NX; j++) for (let i = 0; i < NX; i++) {
    total++; if (fillFromClimate(i, j, k).source === 'planet') planet++;
  }
  cellLive = planet === total && total > 0 && !!reader?.driving();
  return grid;
}
function fillFromClimate(i: number, j: number, k: number) {
  const c = cellClimate(WEATHER.day, WEATHER.hour, layerZ(k), cellX(i), cellZ(j)), n = idx(i, j, k);
  grid.u[n] = c.u; grid.v[n] = c.v; grid.w[n] = 0; grid.th[n] = theta(c.tC, c.p); grid.q[n] = c.rh * qsat(c.tC, c.p); grid.qc[n] = 0; grid.qr[n] = 0;
  if (k === 0 && c.sweMm !== undefined) {
    const col = j * NX + i;
    grid.swe[col] = Math.max(0, c.sweMm);
    if (c.soilMm !== undefined) grid.soil[col] = Math.min(HYDRO.bucketMm, Math.max(0, c.soilMm));
    const surface = c.surfaceTC;
    grid.snowfall[col] = precipFallsAsSnow(surface) && (c.precipMmH ?? 0) > 0 ? 1 : 0;
  }
  return c;
}
export const getGrid = () => grid;
/** Keep the grid centred on the interest centre: scroll whole cells; newly exposed cells come from climatology. */
export function recentre(x: number, z: number) {
  const si = Math.round((x - WEATHER.ox) / DX), sj = Math.round((z - WEATHER.oz) / DX);
  if (!si && !sj) return false;
  const old = grid, N = NX * NX * NY; initWeather(WEATHER.day, WEATHER.hour, WEATHER.ox + si * DX, WEATHER.oz + sj * DX, NX);
  for (const key of ['u', 'v', 'w', 'th', 'q', 'qc', 'qr'] as const) for (let n = 0; n < N; n++) {
    const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX), a = i + si, b = j + sj;
    if (a >= 0 && b >= 0 && a < NX && b < NX) grid[key][n] = old[key][idx(a, b, k)];
  }
  for (const key of ['soil', 'swe', 'runoff'] as const) for (let n = 0; n < NX * NX; n++) {
    const a = n % NX + si, b = Math.floor(n / NX) + sj; if (a >= 0 && b >= 0 && a < NX && b < NX) grid[key][n] = old[key][b * NX + a];
  }
  return true;
}

// ---- surface: type, energy balance, Penman–Monteith ---------------------------------------------------------------
export type SurfaceKind = keyof typeof SURFACE;
let surfaceOf: (x: number, z: number) => SurfaceKind = (x, z) => heightAt(x, z) < LEVEL.waterSurface ? 'water' : 'forest';
/** core/ground registers the top-layer surface type (core stays acyclic). */
export function setSurfaceSource(fn: (x: number, z: number) => SurfaceKind) { surfaceOf = fn; kinds.clear(); }
/** Surface kind per grid column, filled a few cells per frame (ground columns are not free) and kept across recentring. */
const kinds = new Map<string, SurfaceKind>();
const kindAt = (i: number, j: number) => { const key = `${Math.round(cellX(i))}:${Math.round(cellZ(j))}`; return kinds.get(key) ?? (pendingKinds.add(key), 'forest'); };
const pendingKinds = new Set<string>();
function fillKinds(max: number) { for (const key of pendingKinds) { if (max-- <= 0) return; const [x, z] = key.split(':').map(Number); kinds.set(key, surfaceOf(x, z)); pendingKinds.delete(key); if (kinds.size > 4096) kinds.delete(kinds.keys().next().value!); } }
/** Surface energy balance for one column (W/m²). Rn = (1−α)S↓ + (ε_a − ε_s)σT⁴ (net longwave with T_s ≈ T_a; Brutsaert 1975
 * clear-sky ε_a = 1.24 (e/T)^(1/7), e in hPa, raised toward 1 by cloud: Crawford & Duchon 1999), G = 0.1 Rn by day / 0.5 by night
 * (FAO-56 eq. 45–46), λE from Penman–Monteith (Monteith 1965; FAO-56 eq. 3) limited by bucket water β = W/W_fc, H = residual. */
/** Upward longwave and the net term inside `surfaceBalance` (Brutsaert 1975 clear-sky emissivity, Crawford & Duchon 1999 cloud,
 *  surface emissivity 0.98). One formula, so a globe cell and a Kenora column cannot drift apart. */
export function columnLongwave(tC: number, q: number, p: number, cloud: number) {
  const T = tC + 273.15, e = q * p / .622 / 100;
  const ea = Math.min(1, 1.24 * (e / T) ** (1 / 7) * (1 - cloud) + cloud);
  const up = .98 * AIR.sigma * T ** 4;
  return { ea, up, net: (ea - .98) * AIR.sigma * T ** 4 };
}
export function surfaceBalance(kind: SurfaceKind, sw: number, tC: number, q: number, p: number, wind: number, cloud: number, beta: number) {
  const s = SURFACE[kind], T = tC + 273.15, e = q * p / .622 / 100, albedo = f('weather', 'albedo', s.albedo), lw = columnLongwave(tC, q, p, cloud), Lnet = lw.net;
  const Rn = (1 - albedo) * sw + Lnet, G = Rn * (sw > 0 ? .1 : .5);
  const ra = Math.log(10 / s.z0) ** 2 / (AIR.kappa ** 2 * Math.max(.5, wind)); // neutral aerodynamic resistance, s/m (FAO-56 eq. 4, simplified)
  const D = 4098 * esat(tC) / (tC + 237.3) ** 2, vpd = Math.max(0, esat(tC) - e * 100), rho = p / (AIR.Rd * T);
  const LE = Math.max(0, (D * (Rn - G) + rho * AIR.cp * vpd / ra) / (D + AIR.gamma * (1 + s.rs / ra))) * (kind === 'water' ? 1 : beta);
  return { Rn, G, LE, H: Rn - G - LE, E: LE / AIR.Lv, ra, rho };
}

// ---- one step -----------------------------------------------------------------------------------------------------
/** Advance the grid by `dt` game seconds. Order: forcing → microphysics → advection → projection. */
export function stepWeather(dt: number) { const it = stepSlices(dt); let r = it.next(); while (!r.done) r = it.next(); return r.value; }
/** The step as slices (yield between phases) so the runtime spreads one step over several frames. */
export function* stepSlices(dt: number) {
  const g = grid, N = NX * NX * NY, grav = gravity(), fC = 2 * AIR.omega * Math.sin(SITE.lat * RAD);
  const sun = solar(WEATHER.day, WEATHER.hour), clim0 = cellClimate(WEATHER.day, WEATHER.hour, 0, WEATHER.ox, WEATHER.oz);
  g.flux = [];
  // Surface columns: energy balance → bottom-layer heat/moisture; log-law drag; bucket hydrology.
  for (let j = 0; j < NX; j++) for (let i = 0; i < NX; i++) {
    const n = idx(i, j, 0), c = j * NX + i, p = cellClimate(WEATHER.day, WEATHER.hour, layerZ(0), cellX(i), cellZ(j)).p, tC = tempOf(g.th[n], p);
    let lwp = 0; for (let k = 0; k < NY; k++) lwp += g.qc[idx(i, j, k)] * DY; // cloud water path, kg/m² (×ρ≈1)
    const cloud = Math.min(1, lwp / CLOUD_LWP_SAT); // optical saturation near 200 g/m² [verify]
    const kind: SurfaceKind = g.swe[c] > 5 ? 'snow' : kindAt(i, j), U = Math.hypot(g.u[n], g.v[n]);
    const sb = surfaceBalance(kind, shortwave(sun.cosZ, cloud), tC, g.q[n], p, U, cloud, Math.min(1, g.soil[c] / (HYDRO.bucketMm * .75)));
    g.flux[c] = sb;
    g.th[n] += sb.H / (sb.rho * AIR.cp * DY) * dt;
    const evap = Math.min(sb.E * dt, kind === 'water' ? Infinity : g.soil[c]); g.q[n] += evap / (sb.rho * DY); if (kind !== 'water') g.soil[c] -= evap;
    const Cd = (AIR.kappa / Math.log(layerZ(0) / SURFACE[kind].z0)) ** 2, drag = Math.min(1, Cd * U / DY * dt * 4);
    g.u[n] -= g.u[n] * drag; g.v[n] -= g.v[n] * drag;
    // snowpack melt by degree-day; overflow above field capacity → runoff
    if (g.swe[c] > 0 && tC > 0) { const m = Math.min(g.swe[c], HYDRO.ddf * tC * dt / 86400); g.swe[c] -= m; g.soil[c] += m; }
    { const held = bucketStep(g.soil[c], 0); g.runoff[c] += held.runoff; g.soil[c] = held.soil; }
  }
  for (let n = 0; n < N; n++) {
    const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX);
    const c = cellClimate(WEATHER.day, WEATHER.hour, layerZ(k), cellX(i), cellZ(j)), thEnv = theta(c.tC, c.p);
    g.w[n] += grav * (g.th[n] - thEnv) / thEnv * dt; // Boussinesq buoyancy
    const u = g.u[n], v = g.v[n], du = fC * (v - c.v), dv = -fC * (u - c.u); // Coriolis on the ageostrophic part (geostrophic balance)
    g.u[n] += du * dt; g.v[n] += dv * dt;
    // synoptic nudging toward the climate target, 1 h [game calibration]. The target is the planet cell, not climateRaw.
    g.u[n] = relaxToward(g.u[n], c.u, dt); g.v[n] = relaxToward(g.v[n], c.v, dt);
    g.th[n] = relaxToward(g.th[n], thEnv, dt, true); g.q[n] = relaxToward(g.q[n], c.rh * qsat(c.tC, c.p), dt, true);
  }
  convectiveAdjust();
  yield;
  kessler(dt);
  yield;
  const adv = {} as Record<string, Float32Array>;
  for (const key of ['u', 'v', 'w', 'th', 'q', 'qc', 'qr'] as const) { adv[key] = advect(g[key], dt); yield; } // advect from the old velocity
  for (const key of ['u', 'v', 'w', 'th', 'q', 'qc', 'qr'] as const) g[key] = adv[key];
  project();
  for (let n = 0; n < NX * NX; n++) { g.w[n] = Math.max(0, g.w[n]) * .5; } // ground is a wall
  const damp = Math.exp(-dt / 600); // Rayleigh damping of vertical motion, 10 min (sub-grid mixing closure) [game calibration]
  for (let n = 0; n < N; n++) { g.w[n] = Math.max(-10, Math.min(10, g.w[n] * damp)); const sp = Math.hypot(g.u[n], g.v[n]); if (sp > 40) { g.u[n] *= 40 / sp; g.v[n] *= 40 / sp; } } // safety bound
  WEATHER.hour += dt / 3600; if (WEATHER.hour >= 24) { WEATHER.hour -= 24; WEATHER.day = WEATHER.day % 365 + 1; }
  WEATHER.steps++;
  return clim0;
}
/** Dry convective adjustment (Manabe & Strickler 1964, J. Atmos. Sci. 21:361): a statically unstable pair of layers
 * (θ decreasing with height) is mixed to neutral, conserving heat and moisture. Stands in for sub-grid convection. */
/** convectiveAdjust's test: a lower layer with higher θ than the one above is statically unstable. */
export const unstablePair = (thLow: number, thHigh: number) => thLow > thHigh;
function convectiveAdjust() {
  const g = grid;
  for (let c = 0; c < NX * NX; c++) for (let k = 0; k < NY - 1; k++) {
    const a = k * NX * NX + c, b = a + NX * NX;
    if (unstablePair(g.th[a], g.th[b])) { const m = (g.th[a] + g.th[b]) / 2, mq = (g.q[a] + g.q[b]) / 2; g.w[a] += (g.th[a] - g.th[b]) * .02; g.th[a] = g.th[b] = m; g.q[a] = g.q[b] = mq; }
  }
}
/** Kessler warm rain (+ snow at the surface below 0 °C): saturation adjustment with latent heating, autoconversion,
 * accretion, rain evaporation, sedimentation at V_t = 36.34 (ρ q_r)^0.1364 m/s (Klemp & Wilhelmson 1978). */
export function kessler(dt: number) {
  const g = grid;
  for (let k = 0; k < NY; k++) {
    for (let n = k * NX * NX; n < (k + 1) * NX * NX; n++) {
      const i = n % NX, j = Math.floor(n / NX) % NX;
      const p = cellClimate(WEATHER.day, WEATHER.hour, layerZ(k), cellX(i), cellZ(j)).p, exner = (p / AIR.p0) ** (AIR.Rd / AIR.cp);
      const tC = g.th[n] * exner - 273.15, T = tC + 273.15, qs = qsat(tC, p);
      let dq = (g.q[n] - qs) / (1 + AIR.Lv ** 2 * qs / (AIR.cp * AIR.Rv * T * T));
      if (dq < 0) dq = Math.max(dq, -g.qc[n]); // evaporate cloud only as far as it exists
      g.q[n] -= dq; g.qc[n] += dq; g.th[n] += AIR.Lv / AIR.cp * dq / exner;
      const auto = Math.min(g.qc[n], KESSLER.k1 * Math.max(0, g.qc[n] - KESSLER.qc0) * dt), acc = Math.min(g.qc[n] - auto, KESSLER.k2 * g.qc[n] * g.qr[n] ** .875 * dt);
      g.qc[n] -= auto + acc; g.qr[n] += auto + acc;
      if (g.q[n] < qs && g.qr[n] > 0) { const ev = Math.min(g.qr[n], (qs - g.q[n]) * .5 * Math.min(1, dt / 60)); g.qr[n] -= ev; g.q[n] += ev; g.th[n] -= AIR.Lv / AIR.cp * ev / exner; } // [verify] simplified rate
    }
  }
  // sedimentation (upwind, column by column); what leaves the bottom is surface precipitation (kg/m² = mm)
  for (let c = 0; c < NX * NX; c++) {
    let incoming = 0;
    for (let k = NY - 1; k >= 0; k--) {
      const n = k * NX * NX + c, rho = 1, vt = 36.34 * (rho * g.qr[n]) ** .1364;
      const out = Math.min(g.qr[n], g.qr[n] * vt * dt / DY); g.qr[n] += incoming - out; incoming = out;
    }
    const ii = c % NX, jj = Math.floor(c / NX);
    const mm = incoming * DY, tC = tempOf(g.th[c], cellClimate(WEATHER.day, WEATHER.hour, layerZ(0), cellX(ii), cellZ(jj)).p);
    g.precip[c] = mm / dt * 3600; // mm/h
    if (precipFallsAsSnow(tC)) { g.swe[c] += mm; g.snowfall[c] = 1; } else { g.soil[c] += mm; g.snowfall[c] = 0; }
  }
}
function sample(a: Float32Array, x: number, y: number, z: number) {
  const cl = (v: number, m: number) => Math.max(0, Math.min(m - 1.001, v));
  x = cl(x, NX); y = cl(y, NX); z = cl(z, NY);
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
  const L = (ii: number, jj: number, kk: number) => a[idx(Math.min(ii, NX - 1), Math.min(jj, NX - 1), Math.min(kk, NY - 1))];
  const m = (kk: number) => (L(i, j, kk) * (1 - fx) + L(i + 1, j, kk) * fx) * (1 - fy) + (L(i, j + 1, kk) * (1 - fx) + L(i + 1, j + 1, kk) * fx) * fy;
  return m(k) * (1 - fz) + m(k + 1) * fz;
}
/** Semi-Lagrangian advection (Stam 1999): trace each cell centre back along the wind and sample. Unconditionally stable. */
function advect(a: Float32Array, dt: number) {
  const out = new Float32Array(a.length), g = grid;
  for (let n = 0; n < a.length; n++) {
    const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX);
    out[n] = sample(a, i - g.u[n] * dt / DX, j - g.v[n] * dt / DX, k - g.w[n] * dt / DY);
  }
  return out;
}
/** Pressure projection (Stam 1999): Jacobi-solve ∇²p = ∇·u, subtract ∇p, so the flow is divergence-free (incompressible).
 * Terrain deflection enters as the ground wall (w ≥ 0 at the bottom) plus the slope-induced w in `windAt`. */
function project(iters = 12) {
  const g = grid, N = NX * NX * NY, div = new Float32Array(N), p = new Float32Array(N), q = new Float32Array(N);
  const at = (a: Float32Array, i: number, j: number, k: number) => a[idx(Math.max(0, Math.min(NX - 1, i)), Math.max(0, Math.min(NX - 1, j)), Math.max(0, Math.min(NY - 1, k)))];
  const ex = (DX / DY) ** 2;
  for (let n = 0; n < N; n++) { const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX);
    div[n] = (at(g.u, i + 1, j, k) - at(g.u, i - 1, j, k)) / 2 + (at(g.v, i, j + 1, k) - at(g.v, i, j - 1, k)) / 2 + (at(g.w, i, j, k + 1) - at(g.w, i, j, k - 1)) / 2 * DX / DY; }
  for (let it = 0; it < iters; it++) {
    for (let n = 0; n < N; n++) { const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX);
      q[n] = (at(p, i + 1, j, k) + at(p, i - 1, j, k) + at(p, i, j + 1, k) + at(p, i, j - 1, k) + ex * (at(p, i, j, k + 1) + at(p, i, j, k - 1)) - div[n]) / (4 + 2 * ex); }
    p.set(q);
  }
  for (let n = 0; n < N; n++) { const i = n % NX, j = Math.floor(n / NX) % NX, k = Math.floor(n / NX / NX);
    g.u[n] -= (at(p, i + 1, j, k) - at(p, i - 1, j, k)) / 2; g.v[n] -= (at(p, i, j + 1, k) - at(p, i, j - 1, k)) / 2; g.w[n] -= (at(p, i, j, k + 1) - at(p, i, j, k - 1)) / 2 * DY / DX * ex; }
}

// ---- the ONE wind field and point queries --------------------------------------------------------------------------
const gx = (x: number) => (x - WEATHER.ox) / DX + NX / 2 - .5, gz = (z: number) => (z - WEATHER.oz) / DX + NX / 2 - .5;
const inGrid = (x: number, z: number) => Math.abs(x - WEATHER.ox) < NX * DX / 2 && Math.abs(z - WEATHER.oz) < NX * DX / 2;
/** What `weatherAt` returns. The planet grid and the near Stam column both fill this shape. */
export interface PointWeather {
  tC: number; rh: number; cloud: number; rainMmH: number; snow: boolean;
  soil: number; sweMm: number; /** centimetres, `snowDepthCm(sweMm)` */ depthCm: number; fog: number; wind: { x: number; y: number; z: number };
}
function withDepth(w: Omit<PointWeather, 'depthCm'>): PointWeather {
  return { ...w, depthCm: snowDepthCm(w.sweMm) };
}
/** Optional reader for the one Rust grid (`planetWeather.ts`). It is the climate the near cell relaxes toward. */
type PlanetRead = {
  driving(): boolean;
  at(x: number, z: number): PointWeather | null;
  wind(x: number, h: number, z: number, kind: SurfaceKind): { x: number; y: number; z: number } | null;
  /** True when the climate itself was replaced (a new date), so the cell is seeded again. */
  follow(day: number, hour: number): boolean;
  /** Relaxation target at a column. Null when this reader is not the climate. */
  target?(x: number, z: number, heightM: number): CellClimate | null;
};
let reader: PlanetRead | null = null;
/** The near cell has been seeded from the planet and is what the player stands in. */
let cellLive = false;
export function nearCellLive() { return cellLive; }
export function setNearCellLive(on: boolean) { cellLive = on; }
export function registerPlanetRead(r: PlanetRead | null) { reader = r; }

/** The live near cell is the air inside the grid. Outside it, the planet climate. The private formula is only the wasm-absent fallback. */
function standingInCell(x: number, z: number) {
  return !!(reader?.driving() && cellLive && grid && inGrid(x, z));
}
/** Wind (m/s, world axes x east, z south→ grid v maps to +z) at height `h` above ground. Inside the grid: trilinear cell
 * value scaled to `h` by the neutral log wind profile u(h) = u_ref ln(h/z0)/ln(z_ref/z0) (Stull 1988 §9.7). Outside: the climate target. */
export function windAt(x: number, h: number, z: number, kind: SurfaceKind = 'forest') {
  if (!standingInCell(x, z)) {
    const fromPlanet = reader?.wind(x, h, z, kind);
    if (fromPlanet) return fromPlanet;
  }
  const z0 = SURFACE[kind].z0, ref = layerZ(0), scale = h >= ref ? 1 : Math.max(0, Math.log(Math.max(h, z0 * 1.01) / z0) / Math.log(ref / z0));
  if (!standingInCell(x, z) && (!WEATHER.on || !grid || !inGrid(x, z))) { const c = climate(WEATHER.day, WEATHER.hour, Math.max(h, ref)); return { x: c.u * scale, y: 0, z: c.v * scale }; }
  const k = Math.max(0, h / DY - .5), u = sample(grid.u, gx(x), gz(z), k) * scale, v = sample(grid.v, gx(x), gz(z), k) * scale;
  const e = 2, sx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), sz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  return { x: u, y: sample(grid.w, gx(x), gz(z), k) * scale + u * sx + v * sz, z: v }; // terrain deflection: flow follows the slope
}
/** The cell under the player. Layer 0 sits at `layerZ(0)`; the same lapse that built it is added back so the ground reads the surface. */
function cellPoint(x: number, z: number): PointWeather {
  const i = Math.max(0, Math.min(NX - 1, Math.round(gx(x)))), j = Math.max(0, Math.min(NX - 1, Math.round(gz(z)))), n = idx(i, j, 0), col = j * NX + i;
  const clim = cellClimate(WEATHER.day, WEATHER.hour, layerZ(0), cellX(i), cellZ(j));
  const p = clim.p, tLayer = tempOf(grid.th[n], p), tC = tLayer + AIR.lapse * layerZ(0);
  let lwp = 0; for (let k = 0; k < NY; k++) lwp += grid.qc[idx(i, j, k)] * DY;
  const localCloud = Math.min(1, lwp / CLOUD_LWP_SAT);
  const cloud = clim.cloud === undefined ? localCloud : Math.min(1, Math.max(localCloud, clim.cloud));
  const localRain = grid.precip[col];
  const rainMmH = clim.precipMmH === undefined ? localRain : Math.max(localRain, clim.precipMmH);
  return withDepth({ tC, rh: Math.min(1, grid.q[n] / qsat(tLayer, p)), cloud, rainMmH, snow: grid.snowfall[col] > 0, soil: grid.soil[col] / HYDRO.bucketMm,
    sweMm: grid.swe[col], fog: Math.min(1, grid.qc[n] / 3e-4), wind: windAt(x, 10, z) });
}
/** Near-surface weather at (x, z): what rendering, sound, ground and the inspector read.
 *  Inside the live cell, the cell. Outside it, the planet climate. The private formula remains only when wasm did not load. */
export function weatherAt(x: number, z: number): PointWeather {
  if (standingInCell(x, z)) return cellPoint(x, z);
  const fromPlanet = reader?.at(x, z);
  if (fromPlanet) return fromPlanet;
  const c = climate(WEATHER.day, WEATHER.hour, 0);
  if (!WEATHER.on || !grid || !inGrid(x, z)) return withDepth({ tC: c.tC, rh: c.rh, cloud: 0, rainMmH: 0, snow: c.tC < 0, soil: .6, sweMm: 0, fog: 0, wind: windAt(x, 10, z) });
  const i = Math.max(0, Math.min(NX - 1, Math.round(gx(x)))), j = Math.max(0, Math.min(NX - 1, Math.round(gz(z)))), n = idx(i, j, 0), col = j * NX + i;
  const p = cellClimate(WEATHER.day, WEATHER.hour, layerZ(0), cellX(i), cellZ(j)).p, tC = tempOf(grid.th[n], p);
  let lwp = 0; for (let k = 0; k < NY; k++) lwp += grid.qc[idx(i, j, k)] * DY;
  return withDepth({ tC, rh: Math.min(1, grid.q[n] / qsat(tC, p)), cloud: Math.min(1, lwp / CLOUD_LWP_SAT), rainMmH: grid.precip[col], snow: grid.snowfall[col] > 0, soil: grid.soil[col] / HYDRO.bucketMm,
    sweMm: grid.swe[col], fog: Math.min(1, grid.qc[n] / 3e-4), wind: windAt(x, 10, z) });
}
/** Aerodynamic drag on a body (N): F = ½ ρ C_d A |v_rel| v_rel with v_rel = wind − v (Batchelor 1967). */
export function drag(v: { x: number; y?: number; z: number }, wind: { x: number; y: number; z: number }, area: number, cd = 1, rho = 1.2) {
  const rx = wind.x - v.x, ry = wind.y - (v.y ?? 0), rz = wind.z - v.z, m = Math.hypot(rx, ry, rz), k = .5 * rho * cd * area * m;
  return { x: k * rx, y: k * ry, z: k * rz };
}

// ---- runtime: low-rate, amortised, saved ---------------------------------------------------------------------------
let acc = 0, running: Generator<unknown, unknown> | undefined;
/** Called every frame with real seconds and the game's seconds-per-real-second. A step starts at most every 0.5 s real and
 * runs one slice per frame (≈ 0.1–0.6 ms each), so no frame pays for a whole step. */
export function updateWeather(realDt: number, gameSecondsPerReal: number, day: number, hour: number) {
  const spun = reader?.driving() ? reader.follow(day, hour) === true : false;
  // A new date replaces the climate, so the cell is seeded from it again. Between those jumps the cell steps and relaxes.
  if (!grid || (reader?.driving() && (!cellLive || spun))) { running = undefined; initWeather(day, hour, INTEREST.x, INTEREST.z); }
  WEATHER.day = day; WEATHER.hour = hour; // the world clock is the date; a slice may advance the copy, and the next call overwrites it
  if (!WEATHER.on) { running = undefined; return; }
  const t0 = performance.now();
  fillKinds(2);
  acc += realDt;
  if (!running) {
    if (acc < .5) return;
    recentre(INTEREST.x, INTEREST.z);
    running = stepSlices(Math.min(120, acc * gameSecondsPerReal)); acc = 0;
  }
  if (running.next().done) running = undefined;
  WEATHER.ms = performance.now() - t0; WEATHER.msAvg = WEATHER.msAvg * .98 + WEATHER.ms * .02;
}
export const SAVE_KEY_WEATHER = 'boreal.weather.v1';
export const saveWeather = () => JSON.stringify({ w: { day: WEATHER.day, hour: WEATHER.hour, ox: WEATHER.ox, oz: WEATHER.oz, n: NX },
  g: Object.fromEntries((['u', 'v', 'w', 'th', 'q', 'qc', 'qr', 'soil', 'swe', 'runoff'] as const).map(k => [k, Array.from(grid?.[k] ?? [])])) });
export function loadWeather(json: string | null) {
  try { const s = JSON.parse(json ?? ''); initWeather(s.w.day, s.w.hour, s.w.ox, s.w.oz, s.w.n);
    for (const k of ['u', 'v', 'w', 'th', 'q', 'qc', 'qr', 'soil', 'swe', 'runoff'] as const) if (s.g[k]?.length === grid[k].length) grid[k].set(s.g[k]);
    return true; } catch { return false; }
}
