//! Sea-ice fraction split from `hydrosphere_budget.rs` (T-0062, issue #46).
use crate::consts::*;

/// Sea-ice fraction from SST: 1 at or below the freezing point, 0 a degree above, linear between (game calibration of the ramp width).
pub fn ice_fraction(sst_c: f64) -> f64 { ((SEA_ICE_T + 1.0 - sst_c)).clamp(0.0, 1.0) }
/// Sub-grid sea-ice concentration: a cell of height dy (km) holds a spread of SST, Gaussian with σ² = σ0² + (G·dy)²/12 (the
/// variance of a linear gradient G across the cell plus sub-cell eddies σ0); the ice-covered share is P(SST < freezing) =
/// ½ erfc((T − T_f)/(√2 σ)). G = 0.01 K/km high-latitude meridional SST gradient, σ0 = 0.5 K [verify: both order-of-magnitude, from
/// the ~100-200 km marginal ice zone width, Strong & Rigor 2013 GRL 40:4864]. Smooth at any grid size: no hard ice disc.
pub const ICE_G_K_PER_KM: f64 = 0.01;
pub const ICE_SIGMA0_K: f64 = 0.5;
pub fn erfc(x: f64) -> f64 {
    let z = x.abs();
    let t = 1.0 / (1.0 + 0.3275911 * z); // Abramowitz & Stegun 7.1.26, |err| < 1.5e-7
    let y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * (-z * z).exp();
    if x >= 0.0 { y } else { 2.0 - y }
}
pub fn ice_fraction_subgrid(sst_c: f64, dy_km: f64) -> f64 {
    let s = (ICE_SIGMA0_K.powi(2) + (ICE_G_K_PER_KM * dy_km).powi(2) / 12.0).sqrt();
    0.5 * erfc((sst_c - SEA_ICE_T) / (std::f64::consts::SQRT_2 * s))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn subgrid_ice_is_smooth() {
        let a = ice_fraction_subgrid(SEA_ICE_T, 300.0);
        assert!((a - 0.5).abs() < 1e-6);
        assert!(ice_fraction_subgrid(SEA_ICE_T - 3.0, 300.0) > 0.95 && ice_fraction_subgrid(SEA_ICE_T + 3.0, 300.0) < 0.05);
        assert!(ice_fraction_subgrid(SEA_ICE_T + 0.5, 300.0) > 0.2);
    }
    #[test] fn ice_below_freezing() { assert_eq!(ice_fraction(-5.0), 1.0); assert_eq!(ice_fraction(10.0), 0.0); }
}
