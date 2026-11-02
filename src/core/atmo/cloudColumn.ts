/**
 * Local cloud column (grokbot-1, T-0073): stacked atmospheric layers over one sim grid cell, so cloud base and top come from
 * the dew point and the lifting condensation level, not a fixed deck. Constants and sources: data/earth/cloud-column.json.
 *  - environment: a well-mixed (dry-adiabatic) boundary layer up to the LCL (Stull 1988, An Introduction to Boundary Layer
 *    Meteorology, ch. 1), then 6.5 K/km above it (US Std Atm 1976), pressure on an 8.4 km scale height,
 *    vapour q(z) = q0 exp(-z/2 km) (the sim's VAPOUR_SCALE_HEIGHT);
 *  - parcel: lifted from the surface on the dry adiabat (9.8 K/km) keeping its mixing ratio until it reaches its dew point
 *    (the LCL = cloud base), then on the moist adiabat; it holds cloud water while it stays warmer than the environment
 *    (buoyant), which sets the convective top;
 *  - layer (stratiform) cloud wherever the environment's relative humidity reaches the Sundqvist critical value;
 *  - each layer's condensate splits into liquid and ice by temperature (IFS mixed-phase ramp), and the column reports its
 *    freezing level, so glaciated tops (anvils, cirrus) and the melting layer come from the same temperatures.
 * Pure, DOM-free; the renderer (world/globe/localClouds) bakes these layers into a 3D texture around the camera.
 */
import C from '../../../data/earth/cloud-column.json';

/** Saturation vapour pressure (Pa) over water, Bolton 1980. */
export const esatPa = (tC: number) => 100 * C.esat_hPa * Math.exp(C.esat_b * tC / (tC + C.esat_c_C));
/** Dew point (C) from vapour pressure (Pa): Bolton's formula inverted. */
export function dewPointFromE(ePa: number) { const l = Math.log(Math.max(1e-6, ePa) / (100 * C.esat_hPa)); return C.esat_c_C * l / (C.esat_b - l); }
/** Dew point (C) from air temperature (C) and relative humidity (0..1). */
export const dewPointC = (tC: number, rh: number) => dewPointFromE(rh * esatPa(tC));
export const pressureAt = (zM: number) => C.p0_Pa * Math.exp(-zM / C.pressure_scale_m);
const vapourE = (q: number, p: number) => q * p / (C.eps + (1 - C.eps) * q); // specific humidity -> vapour pressure
export const qsat = (tC: number, p: number) => { const e = esatPa(tC); return C.eps * e / Math.max(1, p - (1 - C.eps) * e); };
/** Saturated adiabatic lapse rate (K/m) at T (C), p (Pa). */
export function moistLapse(tC: number, p: number) { const T = tC + 273.15, r = qsat(tC, p);
  return C.g * (1 + C.Lv * r / (C.Rd * T)) / (C.cp + C.Lv * C.Lv * r * C.eps / (C.Rd * T * T)); }

export interface Layer { z: number; tEnv: number; q: number; rh: number; dew: number; tParcel: number; saturated: boolean; water: number; /** stratiform (sheet) share of water, kg/kg */ strat: number; /** ice share of the condensate (0 liquid .. 1 ice) */ ice: number }
export interface Column { lcl: number; top: number; /** height above the ground (m) where the environment reaches 0 C; 0 when the surface is already freezing, -1 if never reached */ freezeM: number; layers: Layer[] }
/** Ice share of cloud condensate at T (C): 0 at or above T0, 1 at or below T_ice, 1 - ((T - T_ice)/(T0 - T_ice))^n between. */
export function iceFraction(tC: number) { if (tC >= C.ice_T0_C) return 0; if (tC <= C.ice_Tice_C) return 1;
  return 1 - Math.pow((tC - C.ice_Tice_C) / (C.ice_T0_C - C.ice_Tice_C), C.ice_exponent); }
/** Opacity per unit condensate relative to liquid, for ice share f (0..1): tau = 3W/(2 rho r_e), so ice (bigger, less dense
 * crystals) is (rho_w r_liq)/(rho_ice r_ice) as opaque; glaciated anvils and cirrus come out thinner than a liquid deck. */
export const iceOpacity = (f: number) => 1 - Math.max(0, Math.min(1, f)) * (1 - 1000 * C.re_liquid_um / (C.rho_ice_kg_m3 * C.re_ice_um));
/** The column over a cell: surface air temperature tsC (C), surface specific humidity q0 (kg/kg), sim cloud fraction (0..1).
 * groundM: the surface's height above sea level (m). Layers stay heights above the ground, but pressure is read at the
 * absolute height (a 3 km plateau starts near 70 kPa, so the same vapour has a lower dew point and a higher base) and a
 * convective top stops at the absolute tropopause. 0 keeps the sea-level column exactly. */
export function cloudColumn(tsC: number, q0: number, cover = 1, topM = C.tropopause_m, dz = C.layer_m, groundM = 0): Column {
  const g0 = Math.max(0, groundM) || 0, pAt = (z: number) => pressureAt(z + g0);
  const layers: Layer[] = []; let tp = tsC, lcl = -1, top = -1, buoyant = true, freezeM = -1;
  const qp = q0; // the parcel keeps its mixing ratio up to the LCL
  let zl = 0; for (let t = tsC; zl <= topM && t > dewPointFromE(vapourE(qp, pAt(zl))); zl += dz) t -= C.g / C.cp * dz; // LCL pre-pass
  const tl = tsC - C.g / C.cp * zl;
  for (let z = 0; z <= topM; z += dz) {
    const p = pAt(z), tEnv = z <= zl ? tsC - C.g / C.cp * z : tl - C.env_lapse_K_per_m * (z - zl), q = q0 * Math.exp(-z / C.vapour_scale_m), e = vapourE(q, p), rh = Math.min(1.2, e / esatPa(tEnv)), dew = dewPointFromE(e);
    if (freezeM < 0 && tEnv <= C.ice_T0_C) freezeM = z;
    const parcelDew = dewPointFromE(vapourE(qp, p)), sat = tp <= parcelDew;
    if (sat && lcl < 0) lcl = z;
    let conv = 0, strat = 0;
    if (lcl >= 0 && buoyant) { if (tp >= tEnv - 1e-9 && z + g0 <= C.tropopause_m) { conv = Math.max(0, qp - qsat(tp, p)); top = z; } else buoyant = false; }
    if (rh >= C.rh_crit) strat = (rh - C.rh_crit) / (1 - C.rh_crit) * 1e-4 * Math.max(0, cover); // stratiform layer cloud
    const water = Math.max(conv, strat);
    layers.push({ z, tEnv, q, rh, dew, tParcel: tp, saturated: sat || rh >= 1, water, strat: strat >= conv ? strat : 0, ice: iceFraction(conv > strat ? tp : tEnv) });
    tp -= (lcl >= 0 ? moistLapse(tp, p) : C.g / C.cp) * dz;
  }
  return { lcl, top, freezeM, layers };
}
/** Cloud base (m): the LCL from the parcel's temperature and dew point (iterated, exact for this model). */
export const cloudBaseM = (tsC: number, q0: number) => cloudColumn(tsC, q0).lcl;
