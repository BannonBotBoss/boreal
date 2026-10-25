//! Surface budget (issue #43, item 4), split across this folder (T-0062, issue #46).
//! Albedo, roughness and heat capacity live in their own files. This module still mixes one cell, because a cell is one surface.
//! Albedo and z0 rows are the `SURFACE` table of `src/core/weather.ts` (Oke 1987; Stull 1988; Raupach 1994).
pub mod land_sea_mask;
pub mod heat_capacity;
pub mod roughness;
pub mod elevation;
pub mod vegetation_fraction;

pub use heat_capacity::{mixed_heatcap, LAND_HEATCAP, OCEAN_HEATCAP};
pub use roughness::{mixed_z0, BARE_Z0, FOREST_Z0, SNOW_Z0, WATER_Z0};
pub use crate::planet_fundamentals::energy::albedo::{mixed_albedo, BARE_ALBEDO, FOREST_ALBEDO, SEA_ICE_ALBEDO, SNOW_ALBEDO, WATER_ALBEDO};

use crate::consts::*;

#[derive(Clone, Copy, Debug)]
pub struct Surf { pub albedo: f64, pub rs: f64, pub z0: f64 }
pub const WATER: Surf = Surf { albedo: WATER_ALBEDO, rs: 0.0, z0: WATER_Z0 };  // Oke 1987 Table 1.1; z0 Stull 1988 Fig 9.6
pub const FOREST: Surf = Surf { albedo: FOREST_ALBEDO, rs: 100.0, z0: FOREST_Z0 };  // Oke 1987; Kelliher et al. 1995; Raupach 1994 [verify]
pub const SNOW_SURF: Surf = Surf { albedo: SNOW_ALBEDO, rs: 0.0, z0: SNOW_Z0 };    // fresh snow .80–.95 (Oke 1987)
/// Bare dry ground: desert albedo .20–.45 (Oke 1987, Table 1.1) → .30 [verify]; rs and z0 are game calibration (the TS has no desert row).
pub const BARE: Surf = Surf { albedo: BARE_ALBEDO, rs: 200.0, z0: BARE_Z0 };
/// Snow covers a cell fully above this depth, mm w.e. (game calibration; smooth ramp so the albedo never steps).
pub const SNOW_FULL_MM: f64 = 20.0;

/// Snow-cover fraction from snow water equivalent (smooth, 0..1).
pub fn snow_fraction(swe_mm: f64) -> f64 { (swe_mm / SNOW_FULL_MM).clamp(0.0, 1.0) }
/// Soil wetness β = W/W_fc of the bucket (Manabe 1969).
pub fn beta(soil_mm: f64) -> f64 { (soil_mm / BUCKET_MM).clamp(0.0, 1.0) }
/// Land kind from the bucket: below β 0.2 the ground is bare (game calibration), else forest.
pub fn land_kind(soil_mm: f64) -> Surf { if beta(soil_mm) < 0.2 { BARE } else { FOREST } }

/// Mixed cell properties (area-weighted by land, sea ice and snow fractions).
#[derive(Clone, Copy, Debug)]
pub struct CellSurface { pub albedo: f64, pub rs: f64, pub z0: f64, pub heatcap: f64, pub snow: f64, pub sea_fraction: f64 }
pub fn cell_surface(land: f64, soil_mm: f64, swe_mm: f64, ice: f64) -> CellSurface {
    let l = land.clamp(0.0, 1.0);
    let snow = snow_fraction(swe_mm);
    let lk = land_kind(soil_mm);
    CellSurface { albedo: mixed_albedo(l, lk.albedo, snow, ice), rs: l * lk.rs, z0: mixed_z0(l, lk.z0, snow),
        heatcap: mixed_heatcap(l), snow: l * snow, sea_fraction: 1.0 - l }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn ocean_is_dark_snow_is_bright() {
        assert!(cell_surface(0.0, 0.0, 0.0, 0.0).albedo < 0.07);
        assert!(cell_surface(1.0, 100.0, 50.0, 0.0).albedo > 0.79);
        assert!(cell_surface(0.0, 0.0, 0.0, 1.0).albedo > 0.55);
    }
    #[test] fn ocean_holds_more_heat_than_land() { assert!(OCEAN_HEATCAP > 50.0 * LAND_HEATCAP); }
    #[test] fn dry_land_is_bare_wet_land_is_forest() { assert_eq!(land_kind(10.0).albedo, BARE.albedo); assert_eq!(land_kind(100.0).albedo, FOREST.albedo); }
}
