//! Hydrosphere budget (issue #43, item 2): evaporation, precipitation, soil moisture, SST, sea ice, humidity column.
//! Reuses `surfaceBalance` (Penman–Monteith) and the Manabe bucket from `src/core/weather.ts`; nothing here is a new climate.
use crate::consts::*;
use crate::solar_budget::atmospheric_emissivity;

/// Saturation vapour pressure, Pa (Bolton 1980, Mon. Weather Rev. 108:1046).
pub fn esat(t_c: f64) -> f64 { 611.2 * (17.67 * t_c / (t_c + 243.5)).exp() }
pub fn qsat(t_c: f64, p: f64) -> f64 { 0.622 * esat(t_c) / (p - 0.378 * esat(t_c)).max(1.0) }

#[derive(Clone, Copy, Debug)]
pub struct Balance { pub rn: f64, pub g: f64, pub le: f64, pub h: f64, pub evap: f64, pub ra: f64, pub rho: f64 }

/// Surface energy balance of one column, W/m² (port of `surfaceBalance`, weather.ts): Rn = (1−α)S↓ + (ε_a − ε_s)σT⁴ (Brutsaert 1975;
/// Crawford & Duchon 1999), G = 0.1 Rn by day / 0.5 by night (FAO-56 eq. 45–46), λE from Penman–Monteith (Monteith 1965; FAO-56 eq. 3)
/// limited by bucket wetness β on land, H = residual. `water` columns are never water-limited.
pub fn surface_balance(albedo: f64, rs: f64, z0: f64, water: bool, sw: f64, t_c: f64, q: f64, p: f64, wind: f64, cloud: f64, beta: f64) -> Balance {
    let t = t_c + 273.15;
    let e = q * p / 0.622 / 100.0; // hPa
    let ea = atmospheric_emissivity(e * 100.0, t, cloud);
    let lnet = (ea - EMISS_SURFACE) * SIGMA * t.powi(4);
    let rn = (1.0 - albedo) * sw + lnet;
    let g = rn * if sw > 0.0 { 0.1 } else { 0.5 };
    let ra = (10.0 / z0).ln().powi(2) / (KAPPA * KAPPA * wind.max(0.5)); // neutral aerodynamic resistance (FAO-56 eq. 4, simplified)
    let d = 4098.0 * esat(t_c) / (t_c + 237.3).powi(2);
    let vpd = (esat(t_c) - e * 100.0).max(0.0);
    let rho = p / (RD * t);
    let le = ((d * (rn - g) + rho * CP * vpd / ra) / (d + GAMMA_PSY * (1.0 + rs / ra))).max(0.0) * if water { 1.0 } else { beta };
    Balance { rn, g, le, h: rn - g - le, evap: le / LV, ra, rho }
}

/// Manabe (1969) bucket step. Adds rain, removes evaporation (kg/m² = mm), overflow becomes runoff.
/// Returns (new soil mm, runoff mm).
pub fn bucket_step(soil_mm: f64, rain_mm: f64, evap_mm: f64) -> (f64, f64) {
    let w = soil_mm + rain_mm - evap_mm;
    (w.clamp(0.0, BUCKET_MM), (w - BUCKET_MM).max(0.0))
}

/// Degree-day snow melt (Hock 2003): mm w.e. per second when air is above 0 °C.
pub fn melt_rate(t_c: f64) -> f64 { DDF * t_c.max(0.0) / 86400.0 }

/// Sea-ice fraction from SST: 1 at or below the freezing point, 0 a degree above, linear between (game calibration of the ramp width).
pub fn ice_fraction(sst_c: f64) -> f64 { ((SEA_ICE_T + 1.0 - sst_c)).clamp(0.0, 1.0) }
/// Sub-grid sea-ice concentration: a cell of height dy (km) holds a spread of SST, Gaussian with σ² = σ0² + (G·dy)²/12 (the
/// variance of a linear gradient G across the cell plus sub-cell eddies σ0); the ice-covered share is P(SST < freezing) =
/// ½ erfc((T − T_f)/(√2 σ)). G = 0.01 K/km high-latitude meridional SST gradient, σ0 = 0.5 K [verify: both order-of-magnitude, from
/// the ~100-200 km marginal ice zone width, Strong & Rigor 2013 GRL 40:4864]. Smooth at any grid size: no hard ice disc.
pub const ICE_G_K_PER_KM: f64 = 0.01; pub const ICE_SIGMA0_K: f64 = 0.5;
pub fn erfc(x: f64) -> f64 { let z = x.abs(); let t = 1.0 / (1.0 + 0.3275911 * z); // Abramowitz & Stegun 7.1.26, |err| < 1.5e-7
    let y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * (-z * z).exp(); if x >= 0.0 { y } else { 2.0 - y } }
pub fn ice_fraction_subgrid(sst_c: f64, dy_km: f64) -> f64 { let s = (ICE_SIGMA0_K.powi(2) + (ICE_G_K_PER_KM * dy_km).powi(2) / 12.0).sqrt(); 0.5 * erfc((sst_c - SEA_ICE_T) / (std::f64::consts::SQRT_2 * s)) }
#[cfg(test)] mod ice_tests { use super::*; #[test] fn subgrid_ice_is_smooth() { let a = ice_fraction_subgrid(SEA_ICE_T, 300.0); assert!((a - 0.5).abs() < 1e-6);
    assert!(ice_fraction_subgrid(SEA_ICE_T - 3.0, 300.0) > 0.95 && ice_fraction_subgrid(SEA_ICE_T + 3.0, 300.0) < 0.05); assert!(ice_fraction_subgrid(SEA_ICE_T + 0.5, 300.0) > 0.2); } }

/// Precipitable water of the humidity column, kg/m²: q_s ρ_s H_q with the water-vapour scale height H_q = 2 km
/// (Wallace & Hobbs 2006, ch. 3 [verify]); exponential decay of q with height.
pub const VAPOUR_SCALE_HEIGHT: f64 = 2000.0;
pub fn column_water(q: f64, p: f64, t_c: f64) -> f64 { q * p / (RD * (t_c + 273.15)) * VAPOUR_SCALE_HEIGHT }

/// Large-scale condensation (Manabe 1965): vapour above saturation falls out as rain. Returns (new q, precipitation kg/m²).
pub fn condense(q: f64, t_c: f64, p: f64) -> (f64, f64) {
    let qs = qsat(t_c, p);
    if q <= qs { return (q, 0.0); }
    (qs, (q - qs) * p / (RD * (t_c + 273.15)) * VAPOUR_SCALE_HEIGHT)
}

#[cfg(test)]
mod tests {
    use super::*;
    // Golden values from weather.ts under tsx: surfaceBalance('forest', 600, 20, .010, 100000, 4, .3, .7) and ('water', 400, 15, .008, 101000, 6, .5, 1); qsat(20, 1e5).
    #[test] fn matches_typescript_forest() {
        let b = surface_balance(0.1, 100.0, 1.5, false, 600.0, 20.0, 0.010, 100000.0, 4.0, 0.3, 0.7);
        assert!((b.rn - 495.32432918444186).abs() < 1e-6, "{}", b.rn);
        assert!((b.le - 109.33662088425943).abs() < 1e-6, "{}", b.le);
        assert!((b.h - 336.45527538173826).abs() < 1e-6);
    }
    #[test] fn matches_typescript_water() {
        let b = surface_balance(0.06, 0.0, 0.0002, true, 400.0, 15.0, 0.008, 101000.0, 6.0, 0.5, 1.0);
        assert!((b.rn - 344.02468049184967).abs() < 1e-6, "{}", b.rn);
        assert!((b.le - 217.04748901449912).abs() < 1e-6);
    }
    #[test] fn qsat_matches() { assert!((qsat(20.0, 100000.0) - 0.014665359912689224).abs() < 1e-12); }
    #[test] fn bucket_overflows() { assert_eq!(bucket_step(140.0, 30.0, 0.0), (150.0, 20.0)); assert_eq!(bucket_step(5.0, 0.0, 10.0).0, 0.0); }
    #[test] fn condense_conserves_water() { let (q, p) = condense(0.03, 20.0, 100000.0); assert!(q < 0.03 && p > 0.0); assert_eq!(condense(0.001, 20.0, 100000.0).1, 0.0); }
    #[test] fn ice_below_freezing() { assert_eq!(ice_fraction(-5.0), 1.0); assert_eq!(ice_fraction(10.0), 0.0); }
}
