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
 *  - precipitable water is the column's vapour path (integral of rho q dz, kg/m2 = mm of rain if it all fell out;
 *    AMS Glossary, 'precipitable water'), so a run can check its moisture against radiosonde climatology;
 *  - CAPE and the equilibrium level use virtual temperature, so water vapour adds buoyancy and condensate loading
 *    takes it away (Emanuel 1994 ch. 4 and ch. 6; AMS Glossary, 'virtual temperature');
 *  - shortwave albedo and transmittance follow the non-absorbing two-stream formulae from the column optical depth
 *    (Lacis & Hansen 1974 at overhead sun; Coakley & Chýlek 1975 for any solar-zenith cosine μ), so a thick tower is
 *    bright on top, still lets diffuse light through to the ground, and looks brighter (lets less through) at low sun
 *    because the path through the deck is longer;
 *  - those shares times the IAU 2015 TSI (Kopp & Lean 2011) and μ give the reflected (to space) and transmitted
 *    (to the ground) shortwave in W/m², instead of fixed climate-model partitions.
 *  - the cloud base radiates longwave down as ε σ T⁴, with ε = 1 − exp(−a0 LWP) (Stephens 1978), so a
 *    thick deck is nearly black and cloudy nights stay warm;
 *  - the cloud top radiates longwave up the same way at the top temperature, so a high cold top sends
 *    less to space than a low warm deck (the longwave greenhouse of deep cloud);
 *  - outgoing longwave above the cloud is that top emission plus the surface upwelling a thin cloud
 *    transmits, F↑ = ε σ T_top⁴ + (1 − ε) σ T_sfc⁴ (Kirchhoff: a non-scattering IR slab transmits
 *    1 − ε), so a black deck hides the ground and a thin cirrus lets most of the warm surface through.
 * Pure, DOM-free; the renderer (world/globe/localClouds) bakes these layers into a 3D texture around the camera.
 */
import C from '../../../data/earth/cloud-column.json';
import { K } from '../constants';

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
export interface Column { lcl: number; top: number; /** convective available potential energy (J/kg): g * integral of (T_v,parcel - T_v,env)/T_v,env over the buoyant cloud layers (virtual temperature: vapour buoyancy minus condensate loading) */ cape: number; /** parcel-theory peak updraught speed (m/s), sqrt(2 * CAPE): the upper bound real towers reach only about half of */ wMax: number; /** how far (m) the tower's momentum carries it above its equilibrium-level top: (w_frac * wMax) / N; 0 with no convection */ overshootM: number; /** condensate path (kg/m2): integral of air density * cloud water over the column, liquid plus ice. Convective water is capped at the Kessler autoconversion threshold, so deep towers read a few kg/m2 like observed cumulonimbus */ waterPath: number; /** cloud optical depth of the column, sum over layers of 3 W / (2 rho r_e) with liquid and ice split by the ice share (Stephens 1978) */ tau: number; /** height above the ground (m) where the environment reaches 0 C; 0 when the surface is already freezing, -1 if never reached */ freezeM: number; /** precipitable water (kg/m2, equal to mm of liquid): integral of air density * specific humidity over the column, ground to topM (AMS Glossary, 'precipitable water') */ pw: number; layers: Layer[] }
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
  const layers: Layer[] = []; let tp = tsC, lcl = -1, top = -1, buoyant = true, freezeM = -1, cape = 0, waterPath = 0, tau = 0, pw = 0;
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
    pw += p / (C.Rd * (tEnv + 273.15)) * q * dz;
    waterPath += wp; tau += 1.5 * wp * ((1 - ice) / (1000 * C.re_liquid_um * 1e-6) + ice / (C.rho_ice_kg_m3 * C.re_ice_um * 1e-6));
    layers.push({ z, tEnv, q, rh, dew, tParcel: tp, saturated: sat || rh >= 1, water, strat: strat >= conv ? strat : 0, ice });
    tp -= (lcl >= 0 ? moistLapse(tp, p) : C.g / C.cp) * dz;
    if (lcl >= 0) tp -= C.entrain_per_m * (tp - tEnv) * dz; // entrainment: the cloudy updraught mixes in environment air and loses buoyancy
  }
  const wMax = Math.sqrt(2 * cape), overshootM = top > lcl && lcl >= 0 ? C.updraught_frac * wMax / C.N_strat_per_s : 0;
  return { lcl, top, cape, wMax, overshootM, waterPath, tau, freezeM, pw, layers };
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
/** Shortwave albedo of a cloud of optical depth tau at solar-zenith cosine mu:
 * two-stream, non-absorbing, A = (1-g)τ / (2μ + (1-g)τ) (Coakley & Chýlek 1975; reduces to Lacis & Hansen 1974
 * and Bohren 1987 when μ = 1). g ~ 0.85. Thin cirrus (τ ~1) at overhead sun reflects ~7%, a stratocumulus deck
 * (τ ~10) ~43%, a cumulonimbus (τ ~100) ~88%; the same deck at μ = 0.5 reflects ~60% because the path is longer. */
export const cloudAlbedo = (tau: number, mu = 1) => {
  const x = (1 - C.asym_g) * Math.max(0, tau);
  return x === 0 ? 0 : x / (2 * Math.max(0, mu) + x);
};
/** Diffuse two-stream transmittance of a non-absorbing cloud: T = 1 − A = 2μ / (2μ + (1-g)τ)
 * (Coakley & Chýlek 1975). Direct-beam exp(−τ/μ) would call a stratocumulus (τ ~10) black underneath;
 * multiple forward scattering still lets about 57% through at overhead sun, and about 40% at μ = 0.5. */
export const cloudTransmittance = (tau: number, mu = 1) => 1 - cloudAlbedo(tau, mu);
/** Shortwave through a non-absorbing cloud: incident = S0 μ, reflected = incident A(τ,μ), transmitted = incident T(τ,μ).
 * S0 is the IAU 2015 TSI from core/constants (Kopp & Lean 2011); μ is the cosine of the solar zenith angle
 * (1 overhead, 0 at the horizon). Conservative: reflected + transmitted = incident. */
export function cloudShortwave(tau: number, mu = 1) {
  const muClamped = Math.max(0, mu);
  const albedo = cloudAlbedo(tau, muClamped), transmittance = cloudTransmittance(tau, muClamped);
  const incident = K.TSI * muClamped;
  return { albedo, transmittance, incident, reflected: incident * albedo, transmitted: incident * transmittance };
}
/** Shortwave under a partly cloudy sky, independent-column approximation: a fraction f of the sky is covered by
 * cloud of optical depth tau and the rest is clear, so the shares mix linearly, A_sky = f A(τ,μ) and
 * T_sky = (1 − f) + f T(τ,μ) (Cahalan et al. 1994; Stephens 1984). f is clamped to [0, 1]; f = 1 is cloudShortwave. */
export function partlyCloudyShortwave(tau: number, mu = 1, cover = 1) {
  const f = Math.min(1, Math.max(0, cover)), cloudy = cloudShortwave(tau, mu);
  const albedo = f * cloudy.albedo, transmittance = 1 - albedo;
  return { cover: f, albedo, transmittance, incident: cloudy.incident, reflected: cloudy.incident * albedo, transmitted: cloudy.incident * transmittance };
}
/** Longwave the cloud base sends down: emissivity ε = 1 − exp(−a0 LWP), LWP in g/m² and a0 = 0.130 m²/g (Stephens 1978),
 * times σT⁴ at the base temperature (the environment at the LCL). A column with no cloud gives 0; a stratocumulus deck
 * (~50 g/m²) is nearly a blackbody, which is why cloudy nights stay warm. Returns W/m². */
export function cloudBaseLongwave(col: Column) {
  if (col.lcl < 0 || col.waterPath <= 0) return { emissivity: 0, baseK: 0, down: 0 };
  const base = col.layers.find(l => l.z >= col.lcl) ?? col.layers[col.layers.length - 1];
  const emissivity = 1 - Math.exp(-C.lw_a0_down_m2_g * col.waterPath * 1000), baseK = base.tEnv + 273.15;
  return { emissivity, baseK, down: emissivity * K.sigma * baseK ** 4 };
}
/** Longwave the cloud top sends up: the same Stephens 1978 emissivity ε = 1 − exp(−a0 LWP),
 * times σT⁴ at the top temperature (the environment in the highest layer that holds condensate).
 * A column with no cloud gives 0; a high cold top radiates less to space than a low warm deck,
 * which is why deep cloud has a longwave greenhouse effect. Returns W/m². */
export function cloudTopLongwave(col: Column) {
  if (col.waterPath <= 0) return { emissivity: 0, topK: 0, up: 0 };
  let top = col.layers[0];
  for (const l of col.layers) if (l.water > 0) top = l;
  const emissivity = 1 - Math.exp(-C.lw_a0_down_m2_g * col.waterPath * 1000), topK = top.tEnv + 273.15;
  return { emissivity, topK, up: emissivity * K.sigma * topK ** 4 };
}
/** Outgoing longwave above the cloud: the top's own emission plus the surface upwelling that a
 * non-scattering IR slab transmits, F↑ = ε σ T_top⁴ + (1 − ε) σ T_sfc⁴ (Kirchhoff's law with the
 * Stephens 1978 emissivity). No cloud (ε = 0) is just the surface; a black deck hides the ground
 * so the OLR is the cold top, which is the longwave greenhouse. T_sfc is the column's lowest-layer
 * environment temperature. Returns W/m². */
export function cloudOutgoingLongwave(col: Column) {
  const top = cloudTopLongwave(col);
  const sfcK = (col.layers[0]?.tEnv ?? 0) + 273.15;
  const surfaceUp = K.sigma * sfcK ** 4;
  return { emissivity: top.emissivity, topK: top.topK, sfcK, surfaceUp, up: top.up + (1 - top.emissivity) * surfaceUp };
}
export const cloudBaseM = (tsC: number, q0: number) => cloudColumn(tsC, q0).lcl;
