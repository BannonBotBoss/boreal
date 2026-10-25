//! Roughness length split from `cell_surface` (T-0062, issue #46).
//! z0 rows: water Stull 1988 Fig 9.6; forest Raupach 1994 [verify]; snow and bare ground as in the surface table.
//! The area-weighted log is the geometric mean (Stull 1988).

pub const WATER_Z0: f64 = 0.0002;
pub const FOREST_Z0: f64 = 1.5;
pub const SNOW_Z0: f64 = 0.001;
pub const BARE_Z0: f64 = 0.01;

pub fn mixed_z0(land: f64, land_z0: f64, snow: f64) -> f64 {
    let l = land.clamp(0.0, 1.0);
    let sea = 1.0 - l;
    (l * (land_z0 * (1.0 - snow) + SNOW_Z0 * snow).ln() + sea * WATER_Z0.ln()).exp()
}
