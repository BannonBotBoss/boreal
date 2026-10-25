//! Cloud optical depth split from `atmosphere_budget.rs` (T-0062, issue #46). Stephens 1978.
use crate::consts::*;

/// Cloud optical depth τ = 3 LWP / (2 ρw re) (Stephens 1978, J. Atmos. Sci. 35:2123) with a mean liquid-water path of 0.08 kg/m²
/// per unit cloud fraction (~ 80 g/m²; Han et al. 1994 [verify]) and effective radius 10 µm (Han et al. 1994 [verify]).
pub const LWP_REF: f64 = 0.08;
pub const EFFECTIVE_RADIUS: f64 = 10e-6;
pub fn cloud_optical_depth(cloud: f64) -> f64 { 3.0 * LWP_REF * cloud / (2.0 * RHO_WATER * EFFECTIVE_RADIUS) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn optical_depth_of_overcast_is_about_a_dozen() { let t = cloud_optical_depth(1.0); assert!(t > 5.0 && t < 30.0, "{}", t); }
}
