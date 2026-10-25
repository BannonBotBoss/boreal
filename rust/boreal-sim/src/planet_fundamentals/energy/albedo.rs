//! Albedo split from `surface_budget.rs` and `climate_seed::planetary_albedo` (T-0062, issue #46).
//! Surface rows are Oke 1987 Table 1.1. Planetary albedo is Budyko 1969 (ice) and the Legendre fit of
//! North, Cahalan & Coakley 1981 (ice-free).
pub const WATER_ALBEDO: f64 = 0.06; // Oke 1987 Table 1.1
pub const FOREST_ALBEDO: f64 = 0.10; // Oke 1987
pub const SNOW_ALBEDO: f64 = 0.80; // fresh snow .80–.95 (Oke 1987)
/// Bare dry ground: desert albedo .20–.45 (Oke 1987, Table 1.1) → .30 [verify].
pub const BARE_ALBEDO: f64 = 0.30;
/// Snow-free sea ice albedo .5–.7 (Brandt et al. 2005, J. Climate 18:3606) → .6 [verify].
pub const SEA_ICE_ALBEDO: f64 = 0.6;
/// A0, A2 [calibrated: chosen within the ERBE zonal range so the annual mean is 14.3 °C (Jones 1999: 14.0) and the equator 26.8 °C]
pub const ALB_A0: f64 = 0.285;
pub const ALB_A2: f64 = 0.05;

/// Planetary albedo: 0.62 where T < −10 °C (Budyko 1969); ice-free it rises with latitude, α = A0 + A2·P2(sin φ).
pub fn planetary_albedo_at(t_c: f64, lat: f64) -> f64 {
    if t_c < -10.0 { 0.62 } else { let x = lat.to_radians().sin(); ALB_A0 + ALB_A2 * 0.5 * (3.0 * x * x - 1.0) }
}
pub fn planetary_albedo(t_c: f64) -> f64 { planetary_albedo_at(t_c, 30.0) }

/// Area-weighted land/sea albedo. Snow mixes on the land albedo; sea ice mixes on the water albedo. Same expression as `cell_surface`.
pub fn mixed_albedo(land: f64, land_albedo: f64, snow: f64, ice: f64) -> f64 {
    let l = land.clamp(0.0, 1.0);
    let land_a = land_albedo * (1.0 - snow) + SNOW_ALBEDO * snow;
    let sea_a = WATER_ALBEDO * (1.0 - ice) + SEA_ICE_ALBEDO * ice;
    l * land_a + (1.0 - l) * sea_a
}
