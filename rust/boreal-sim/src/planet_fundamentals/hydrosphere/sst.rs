//! Sea-surface temperature plane (T-0062, issue #46). The value is the seeded or stepped surface temperature
//! on water. Land keeps the sentinel already written by the grid (−999), which is not a physical temperature.
pub const LAND_SST_SENTINEL: f64 = -999.0;

pub fn sea_surface_temperature(land: f64, t_c: f64) -> f64 {
    if land < 0.5 { t_c } else { LAND_SST_SENTINEL }
}
