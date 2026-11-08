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
 *    freezing level, so glaciated tops (anvils, cirrus) and the melting layer come from the same temperatures;
 *  - convective condensate is capped at the Kessler 1969 autoconversion threshold (qc_auto_kg_kg), so water path and
 *    optical depth are the suspended cloud after warm-rain fallout, not the adiabatic upper bound;
 *  - CAPE and the equilibrium level use virtual temperature, so water vapour adds buoyancy and condensate loading
 *    takes it away (Emanuel 1994 ch. 4 and ch. 6; AMS Glossary, 'virtual temperature').
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
export interface Column { lcl: number; top: number; /** convective available potential energy (J/kg): g * integral of (T_v,parcel - T_v,env)/T_v,env over the buoyant cloud layers (virtual temperature: vapour buoyancy minus condensate loading) */ cape: number; /** parcel-theory peak updraught speed (m/s), sqrt(2 * CAPE): the upper bound real towers reach only about half of */ wMax: number; /** how far (m) the tower's momentum carries it above its equilibrium-level top: (w_frac * wMax) / N; 0 with no convection */ overshootM: number; /** condensate path (kg/m2): integral of air density * cloud water over the column, liquid plus ice. Convective water is capped at the Kessler autoconversion threshold, so deep towers read a few kg/m2 like observed cumulonimbus */ waterPath: number; /** cloud optical depth of the column, sum over layers of 3 W / (2 rho r_e) with liquid and ice split by the ice share (Stephens 1978) */ tau: number; /** height above the ground (m) where the environment reaches 0 C; 0 when the surface is already freezing, -1 if never reached */ freezeM: number; layers: Layer[] }
/** Virtual temperature (K): T (1 + (1/ε − 1) q − q_c). Moisture lightens the air; suspended condensate loads it
 *  (Emanuel 1994, Atmospheric Convection, ch. 4; AMS Glossary of Meteorology, 'virtual temperature'). q and q_c are
 *  specific humidity and condensate mixing ratio (kg/kg). */
export function virtualTempK(tC: number, q = 0, qc = 0) {
  return (tC + 273.15) * (1 + (1 / C.eps - 1) * Math.max(0, q) - Math.max(0, qc));
}
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
  const layers: Layer[] = []; let tp = tsC, lcl = -1, top = -1, buoyant = true, freezeM = -1, cape = 0, waterPath = 0, tau = 0;
  const qp = q0; // the parcel keeps its mixing ratio up to the LCL
  let zl = 0; for (let t = tsC; zl <= topM && t > dewPointFromE(vapourE(qp, pAt(zl))); zl += dz) t -= C.g / C.cp * dz; // LCL pre-pass
  const tl = tsC - C.g / C.cp * zl;
  for (let z = 0; z <= topM; z += dz) {
    const p = pAt(z), tEnv = z <= zl ? tsC - C.g / C.cp * z : tl - C.env_lapse_K_per_m * (z - zl), q = q0 * Math.exp(-z / C.vapour_scale_m), e = vapourE(q, p), rh = Math.min(1.2, e / esatPa(tEnv)), dew = dewPointFromE(e);
    if (freezeM < 0 && tEnv <= C.ice_T0_C) freezeM = z;
    const parcelDew = dewPointFromE(vapourE(qp, p)), sat = tp <= parcelDew;
    if (sat && lcl < 0) lcl = z;
    let conv = 0, strat = 0;
    if (lcl >= 0 && buoyant) {
      conv = Math.min(C.qc_auto_kg_kg, Math.max(0, qp - qsat(tp, p)));
      const qParcel = sat ? qsat(tp, p) : qp;
      const tvP = virtualTempK(tp, qParcel, conv), tvE = virtualTempK(tEnv, q);
      if (tvP >= tvE - 1e-9 && z + g0 <= C.tropopause_m) { top = z; cape += C.g * (tvP - tvE) / tvE * dz; }
      else { conv = 0; buoyant = false; }
    }
    if (rh >= C.rh_crit) strat = (rh - C.rh_crit) / (1 - C.rh_crit) * 1e-4 * Math.max(0, cover); // stratiform layer cloud
    const water = Math.max(conv, strat), ice = iceFraction(conv > strat ? tp : tEnv), wp = p / (C.Rd * (tEnv + 273.15)) * water * dz;
    waterPath += wp; tau += 1.5 * wp * ((1 - ice) / (1000 * C.re_liquid_um * 1e-6) + ice / (C.rho_ice_kg_m3 * C.re_ice_um * 1e-6));
    layers.push({ z, tEnv, q, rh, dew, tParcel: tp, saturated: sat || rh >= 1, water, strat: strat >= conv ? strat : 0, ice });
    tp -= (lcl >= 0 ? moistLapse(tp, p) : C.g / C.cp) * dz;
    if (lcl >= 0) tp -= C.entrain_per_m * (tp - tEnv) * dz; // entrainment: the cloudy updraught mixes in environment air and loses buoyancy
  }
  const wMax = Math.sqrt(2 * cape), overshootM = top > lcl && lcl >= 0 ? C.updraught_frac * wMax / C.N_strat_per_s : 0;
  return { lcl, top, cape, wMax, overshootM, waterPath, tau, freezeM, layers };
}
/** Share of precipitation reaching the ground as snow (0 rain .. 1 snow) for a column: it needs ice aloft to fall from, and
 * the flakes melt over the melting layer (melt_layer_m) below the freezing level. Surface already freezing gives all snow,
 * a freezing level a full melting layer above the ground gives all rain, linear between; no ice cloud means warm rain. */
export function snowShareAtGround(col: Column) {
  return snowShareFromFreezing(col.freezeM, col.layers.some(l => l.water > 0 && l.ice > 0));
}
/** The same melting-layer rule from a freezing level (m above the ground; 0 freezing at the surface, -1 never) and whether
 * there is ice aloft to fall from. Shared by the cloud column and the weather grid's surface precipitation. */
export function snowShareFromFreezing(freezeM: number, iceAloft: boolean) {
  if (!iceAloft || freezeM < 0) return 0;
  return Math.max(0, Math.min(1, 1 - freezeM / C.melt_layer_m));
}
/** Cloud base (m): the LCL from the parcel's temperature and dew point (iterated, exact for this model). */
export const cloudBaseM = (tsC: number, q0: number) => cloudColumn(tsC, q0).lcl;
