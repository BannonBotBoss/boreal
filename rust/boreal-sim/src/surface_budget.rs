//! Surface budget (issue #43, item 4): land/sea mix, albedo, roughness, heat capacity, snow cover.
//! Albedo and z0 rows are the `SURFACE` table of `src/core/weather.ts` (Oke 1987; Stull 1988; Raupach 1994).
use crate::consts::*;

#[derive(Clone, Copy, Debug)]
pub struct Surf { pub albedo: f64, pub rs: f64, pub z0: f64 }
pub const WATER: Surf = Surf { albedo: 0.06, rs: 0.0, z0: 0.0002 };  // Oke 1987 Table 1.1; z0 Stull 1988 Fig 9.6
pub const FOREST: Surf = Surf { albedo: 0.10, rs: 100.0, z0: 1.5 };  // Oke 1987; Kelliher et al. 1995; Raupach 1994 [verify]
pub const SNOW_SURF: Surf = Surf { albedo: 0.80, rs: 0.0, z0: 0.001 };    // fresh snow .80–.95 (Oke 1987)
/// Bare dry ground: desert albedo .20–.45 (Oke 1987, Table 1.1) → .30 [verify]; rs and z0 are game calibration (the TS has no desert row).
pub const BARE: Surf = Surf { albedo: 0.30, rs: 200.0, z0: 0.01 };
/// Snow-free sea ice albedo .5–.7 (Brandt et al. 2005, J. Climate 18:3606) → .6 [verify].
pub const SEA_ICE_ALBEDO: f64 = 0.6;
/// Snow covers a cell fully above this depth, mm w.e. (game calibration; smooth ramp so the albedo never steps).
pub const SNOW_FULL_MM: f64 = 20.0;

/// Volumetric heat capacity of sea water, 4.18e6 J/m³/K (Wallace & Hobbs 2006) × mixed-layer depth 50 m (Levitus 1982; Kara et al. 2003 give
/// 20–100 m, global mean ~ 50–60 m) [verify]. Land: wet mineral soil ≈ 2.0e6 J/m³/K (Oke 1987, Table 2.1) × a 0.5 m daily-to-weekly active
/// layer (game calibration).
pub const OCEAN_HEATCAP: f64 = 4.18e6 * 50.0;
pub const LAND_HEATCAP: f64 = 2.0e6 * 0.5;

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
    let sea = 1.0 - l;
    let snow = snow_fraction(swe_mm);
    let lk = land_kind(soil_mm);
    let land_a = lk.albedo * (1.0 - snow) + SNOW_SURF.albedo * snow;
    let sea_a = WATER.albedo * (1.0 - ice) + SEA_ICE_ALBEDO * ice;
    // roughness: the area-weighted log keeps z0 positive (effective roughness is geometric, Stull 1988)
    let z0 = (l * (lk.z0 * (1.0 - snow) + SNOW_SURF.z0 * snow).ln() + sea * WATER.z0.ln()).exp();
    CellSurface { albedo: l * land_a + sea * sea_a, rs: l * lk.rs, z0, heatcap: l * LAND_HEATCAP + sea * OCEAN_HEATCAP, snow: l * snow, sea_fraction: sea }
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
