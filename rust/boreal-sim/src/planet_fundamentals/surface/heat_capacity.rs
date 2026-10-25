//! Heat capacity split from `surface_budget.rs` (T-0062, issue #46).
//! Ocean: 4.18e6 J/m³/K (Wallace & Hobbs 2006) × mixed-layer depth 50 m (Levitus 1982; Kara et al. 2003 give
//! 20–100 m, global mean ~ 50–60 m) [verify]. Land: wet mineral soil ≈ 2.0e6 J/m³/K (Oke 1987, Table 2.1) × a 0.5 m
//! daily-to-weekly active layer (game calibration).

pub const OCEAN_HEATCAP: f64 = 4.18e6 * 50.0;
pub const LAND_HEATCAP: f64 = 2.0e6 * 0.5;

pub fn mixed_heatcap(land: f64) -> f64 {
    let l = land.clamp(0.0, 1.0);
    l * LAND_HEATCAP + (1.0 - l) * OCEAN_HEATCAP
}
