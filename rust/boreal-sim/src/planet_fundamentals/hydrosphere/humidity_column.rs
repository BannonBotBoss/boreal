//! Humidity column split from `hydrosphere_budget.rs` (T-0062, issue #46): Bolton 1980 qsat and precipitable water.
use crate::consts::*;

/// Saturation vapour pressure, Pa (Bolton 1980, Mon. Weather Rev. 108:1046).
pub fn esat(t_c: f64) -> f64 { 611.2 * (17.67 * t_c / (t_c + 243.5)).exp() }
pub fn qsat(t_c: f64, p: f64) -> f64 { 0.622 * esat(t_c) / (p - 0.378 * esat(t_c)).max(1.0) }

/// Precipitable water of the humidity column, kg/m²: q_s ρ_s H_q with the water-vapour scale height H_q = 2 km
/// (Wallace & Hobbs 2006, ch. 3 [verify]); exponential decay of q with height.
pub const VAPOUR_SCALE_HEIGHT: f64 = 2000.0;
/// Boundary-layer ventilation (update_moisture 1b): target RH (Manabe & Wetherald 1967) and time scale 3 days, s: within the boundary-layer residence times of Betts & Ridgway 1989 [verify]; chosen so July 30-90N cover is 0.56/0.75/0.77/0.70 vs ISCCP-class 0.55/0.70/0.80 [calibrated]
pub const BL_RH: f64 = 0.77;
pub const BL_VENT_S: f64 = 259200.0;
pub fn column_water(q: f64, p: f64, t_c: f64) -> f64 { q * p / (RD * (t_c + 273.15)) * VAPOUR_SCALE_HEIGHT }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn qsat_matches() { assert!((qsat(20.0, 100000.0) - 0.014665359912689224).abs() < 1e-12); }
}
