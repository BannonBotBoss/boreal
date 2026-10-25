//! Longwave terms split from `solar_budget.rs` (T-0062, issue #46).
//! Brutsaert (1975) clear-sky emissivity, Crawford & Duchon (1999) cloud, surface emission ε σ T⁴.
//! Outgoing longwave I = A + B·T (North & Coakley 1979, J. Atmos. Sci. 36:1189) lives here too; the climate seed reads it.
use crate::consts::*;

/// Brutsaert (1975) clear-sky atmospheric emissivity ε_a = 1.24 (e/T)^(1/7), e in hPa, raised toward 1 by cloud
/// (Crawford & Duchon 1999), exactly as `surfaceBalance` in weather.ts. `e_pa` is the vapour pressure in Pa.
pub fn atmospheric_emissivity(e_pa: f64, t_k: f64, cloud: f64) -> f64 {
    (1.24 * (e_pa / 100.0 / t_k).powf(1.0 / 7.0) * (1.0 - cloud) + cloud).min(1.0)
}

/// Q_longwave_out = ε σ T_s⁴ (surface emission).
pub fn surface_emission(t_surface_c: f64) -> f64 {
    let t = t_surface_c + 273.15;
    EMISS_SURFACE * SIGMA * t.powi(4)
}

/// lw_net = (ε_a − ε_s) σ T⁴ (negative for a warm surface under a colder sky).
pub fn longwave_net(e_pa: f64, t_surface_c: f64, cloud: f64) -> f64 {
    let t = t_surface_c + 273.15;
    let ea = atmospheric_emissivity(e_pa, t, cloud);
    (ea - EMISS_SURFACE) * SIGMA * t.powi(4)
}

/// Outgoing longwave I = A + B·T (T in °C): A = 203.3 W/m², B = 2.09 W/m²/K (North & Coakley 1979, J. Atmos. Sci. 36:1189).
pub const OLR_A: f64 = 203.3;
pub const OLR_B: f64 = 2.09;
