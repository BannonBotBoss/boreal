//! Hydrostatic pressure split from `atmosphere_budget.rs` (T-0062, issue #46).
//! The form is `climate()` in weather.ts. Sea-level pressure is the hypsometric equation (Wallace & Hobbs 2006, eq. 3.23).
use crate::consts::*;

/// Hydrostatic surface pressure from sea-level pressure over height `z` (the form `climate()` uses): p = p_sl exp(−g z / (Rd T)).
pub fn surface_pressure(p_sl: f64, z: f64, t_c: f64) -> f64 { p_sl * (-gravity() * z / (RD * (t_c + 273.15))).exp() }

/// Sea-level pressure from the column temperature by the hypsometric equation (Wallace & Hobbs 2006, eq. 3.23): with the 500 hPa
/// surface held at its standard-atmosphere height z5 = 5574 m (ISO 2533), p_sl = p5 exp(g z5 / (Rd T_col)). A warmer column is
/// thicker and gives a lower sea-level pressure (thermal low). T_col is the surface air temperature minus half the lapse across z5.
pub const P500: f64 = 50000.0;
pub const Z500: f64 = 5574.0;
pub fn sea_level_pressure(t_air_c: f64) -> f64 {
    let t_col = t_air_c + 273.15 - LAPSE * Z500 / 2.0;
    P500 * (gravity() * Z500 / (RD * t_col)).exp()
}

/// Zonal-mean sea-level pressure belts, hPa at latitudes 0, 15, …, 90 (equatorial trough, subtropical highs, subpolar lows, polar high), read
/// symmetrically from the annual zonal means of Peixoto & Oort (1992, Physics of Climate, ch. 7) / Hartmann (1994) [verify values].
/// Hypsometric thickness alone cannot supply these: it fixes the thickness of the column, not the mass beneath it, and it puts a high over the
/// cold pole. The land–sea and seasonal anomalies still come from `sea_level_pressure`.
pub const PRESSURE_BELTS_HPA: [f64; 7] = [1011.0, 1013.0, 1017.0, 1013.0, 1001.0, 1007.0, 1013.0];
pub fn belt_pressure(lat_deg: f64) -> f64 {
    let x = (lat_deg.abs() / 15.0).clamp(0.0, 5.999999); let i = x.floor() as usize; let t = x - i as f64; let t = t * t * (3.0 - 2.0 * t);
    100.0 * (PRESSURE_BELTS_HPA[i] * (1.0 - t) + PRESSURE_BELTS_HPA[i + 1] * t)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn standard_atmosphere_gives_one_atmosphere() {
        let p = sea_level_pressure(15.0);
        assert!((p - P0).abs() < 800.0, "p_sl {}", p); // within 8 hPa of 1013 (hypsometric, standard column)
    }
    #[test] fn warm_column_is_a_low() { assert!(sea_level_pressure(30.0) < sea_level_pressure(0.0)); }
}
