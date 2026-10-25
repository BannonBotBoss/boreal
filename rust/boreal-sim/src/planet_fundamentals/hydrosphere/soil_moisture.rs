//! Manabe (1969) bucket, split from `hydrosphere_budget.rs` (T-0062, issue #46).
//! Field capacity is `BUCKET_MM` (150 mm). Adds rain, removes evaporation (kg/m² = mm), overflow becomes runoff.
use crate::consts::*;

/// Returns (new soil mm, runoff mm).
pub fn bucket_step(soil_mm: f64, rain_mm: f64, evap_mm: f64) -> (f64, f64) {
    let w = soil_mm + rain_mm - evap_mm;
    (w.clamp(0.0, BUCKET_MM), (w - BUCKET_MM).max(0.0))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn bucket_overflows() { assert_eq!(bucket_step(140.0, 30.0, 0.0), (150.0, 20.0)); assert_eq!(bucket_step(5.0, 0.0, 10.0).0, 0.0); }
}
