//! Sun as a blackbody (T-0067), mirror of src/world/sun/spectrum.ts for the sim side.
//! Teff 5772 K, R_sun 695 700 km, AU (IAU 2015 B3); TSI 1361 W/m^2 (Kopp & Lean 2011).
pub const TEFF: f64 = 5772.0;
pub const R_SUN: f64 = 695_700e3;
pub const AU: f64 = 1.495_978_707e11;
const H: f64 = 6.626_070_15e-34; const C: f64 = 299_792_458.0; const KB: f64 = 1.380_649e-23; const SIGMA: f64 = 5.670_374_419e-8;
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
