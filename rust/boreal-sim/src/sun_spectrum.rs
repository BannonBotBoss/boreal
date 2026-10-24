//! Sun as a blackbody (T-0067), mirror of src/world/sun/spectrum.ts for the sim side.
//! Teff 5772 K, R_sun 695 700 km, AU (IAU 2015 B3); TSI 1361 W/m^2 (Kopp & Lean 2011).
use crate::constants as K;
pub const TEFF: f64 = K::Teff_sun;
pub const R_SUN: f64 = K::R_sun;
pub const AU: f64 = K::AU;
const H: f64 = K::h; const C: f64 = K::c; const KB: f64 = K::k_B; const SIGMA: f64 = K::sigma;
/// Planck spectral radiance, W m^-2 sr^-1 m^-1
pub fn planck(lambda_m: f64, t: f64) -> f64 { 2.0 * H * C * C / lambda_m.powi(5) / (H * C / (lambda_m * KB * t)).exp_m1() }
/// irradiance at distance d (m)
pub fn flux_at(d: f64) -> f64 { SIGMA * TEFF.powi(4) * (R_SUN / d).powi(2) }
/// angular radius (rad)
pub fn angular_radius(d: f64) -> f64 { (R_SUN / d).asin() }
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn tsi() { assert!((flux_at(AU) - 1361.0).abs() < 2.0); }
    #[test] fn size() { assert!((angular_radius(AU).to_degrees() - 0.2666).abs() < 5e-4); }
    #[test] fn wien_peak_near_502nm() { let p = (300i32..900).max_by(|a, b| planck(*a as f64 * 1e-9, TEFF).partial_cmp(&planck(*b as f64 * 1e-9, TEFF)).unwrap()).unwrap(); assert!((p - 502).abs() < 3); }
}
