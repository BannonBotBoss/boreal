//! Vertical instability split from `atmosphere_budget.rs` (T-0062, issue #46).
//! The test is the dry adiabat already used by the port (Wallace & Hobbs 2006, §3.5; Manabe & Strickler 1964 is the near-field adjuster in weather.ts).
use crate::consts::*;

/// Vertical instability, K/km: the layer lapse rate implied by the surface superheat, minus the dry adiabat g/cp (Wallace & Hobbs 2006, §3.5).
/// Positive means convectively unstable. The layer is 1 km deep with the standard environmental lapse (ISO 2533) above the air temperature.
pub fn vertical_instability(t_surface_c: f64, t_air_c: f64) -> f64 { ((t_surface_c - t_air_c) + LAPSE * 1000.0) - gravity() / CP * 1000.0 }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn superheat_is_unstable() { assert!(vertical_instability(35.0, 25.0) > 0.0); assert!(vertical_instability(20.0, 20.0) < 0.0); }
}
