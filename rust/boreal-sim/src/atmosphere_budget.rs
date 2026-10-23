//! Atmosphere budget (issue #43, item 3): cloud fraction, cloud optical depth, pressure, geostrophic wind, convective instability.
//! The near-field weather grid (`stepSlices`, Stam stable fluids + Kessler) stays in TypeScript; this is the far-field planet field,
//! a pure function of the cell state (PROJECT-RULES 8).
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

/// Coriolis parameter f = 2 Ω sin φ.
pub fn coriolis(lat_deg: f64) -> f64 { 2.0 * OMEGA * (lat_deg * std::f64::consts::PI / 180.0).sin() }

/// Geostrophic balance does not hold near the equator (f → 0; Holton 2004, §3.2): |f| is floored at its value at 5°.
pub const GEOSTROPHIC_MIN_LAT: f64 = 5.0;
/// Surface wind is a fraction of the geostrophic wind because of boundary-layer friction, about 0.6–0.8 (Wallace & Hobbs 2006, §8.2) → 0.7 [verify].
pub const FRICTION_FACTOR: f64 = 0.7;
pub const MAX_WIND: f64 = 40.0; // m/s guard on the closed form (game calibration)

/// Geostrophic wind (u east, v north) from pressure gradients (Pa/m, east and north) and density: u = −(1/ρf) ∂p/∂y, v = (1/ρf) ∂p/∂x.
pub fn geostrophic(dpdx: f64, dpdy: f64, rho: f64, lat_deg: f64) -> (f64, f64) {
    let f0 = coriolis(lat_deg);
    let fmin = coriolis(GEOSTROPHIC_MIN_LAT);
    let f = if f0.abs() < fmin { fmin * if f0 < 0.0 { -1.0 } else { 1.0 } } else { f0 };
    let (mut u, mut v) = (-dpdy / (rho * f) * FRICTION_FACTOR, dpdx / (rho * f) * FRICTION_FACTOR);
    let s = u.hypot(v);
    if s > MAX_WIND { u *= MAX_WIND / s; v *= MAX_WIND / s; }
    (u, v)
}

/// Cloud fraction from relative humidity (Sundqvist, Berge & Kristjánsson 1989, Mon. Weather Rev. 117:1641): C = 1 − sqrt((1−RH)/(1−RHc)) for RH > RHc.
pub const RH_CRIT: f64 = 0.75; // critical RH, typical 0.7–0.9 [verify]
pub fn cloud_fraction(rh: f64) -> f64 { if rh <= RH_CRIT { 0.0 } else { (1.0 - ((1.0 - rh.min(1.0)) / (1.0 - RH_CRIT)).sqrt()).clamp(0.0, 1.0) } }

/// Cloud optical depth τ = 3 LWP / (2 ρw re) (Stephens 1978, J. Atmos. Sci. 35:2123) with a mean liquid-water path of 0.08 kg/m²
/// per unit cloud fraction (~ 80 g/m²; Han et al. 1994 [verify]) and effective radius 10 µm (Han et al. 1994 [verify]).
pub const LWP_REF: f64 = 0.08;
pub const EFFECTIVE_RADIUS: f64 = 10e-6;
pub fn cloud_optical_depth(cloud: f64) -> f64 { 3.0 * LWP_REF * cloud / (2.0 * RHO_WATER * EFFECTIVE_RADIUS) }

/// Vertical instability, K/km: the layer lapse rate implied by the surface superheat, minus the dry adiabat g/cp (Wallace & Hobbs 2006, §3.5).
/// Positive means convectively unstable. The layer is 1 km deep with the standard environmental lapse (ISO 2533) above the air temperature.
pub fn vertical_instability(t_surface_c: f64, t_air_c: f64) -> f64 { ((t_surface_c - t_air_c) + LAPSE * 1000.0) - gravity() / CP * 1000.0 }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn standard_atmosphere_gives_one_atmosphere() {
        let p = sea_level_projected(15.0);
        assert!((p - P0).abs() < 800.0, "p_sl {}", p); // within 8 hPa of 1013 (hypsometric, standard column)
    }
    fn sea_level_projected(t: f64) -> f64 { sea_level_pressure(t) }
    #[test] fn belts_make_trades_and_westerlies() {
        let dp = |a: f64, b: f64| (belt_pressure(b) - belt_pressure(a)) / ((b - a).to_radians() * EARTH_RADIUS);
        let (u15, _) = geostrophic(0.0, dp(10.0, 20.0), 1.2, 15.0); let (u45, _) = geostrophic(0.0, dp(40.0, 50.0), 1.2, 45.0);
        assert!(u15 < 0.0 && u45 > 0.0, "{} {}", u15, u45); // easterly trades, westerlies
    }
    #[test] fn warm_column_is_a_low() { assert!(sea_level_pressure(30.0) < sea_level_pressure(0.0)); }
    #[test] fn coriolis_sign_and_size() { assert!((coriolis(45.0) - 1.0313e-4).abs() < 2e-7); assert!(coriolis(-30.0) < 0.0); }
    #[test] fn wind_circles_a_low_counter_clockwise_in_north() {
        // low to the north-east-centre: pressure rises to the south of a low centre → dpdy > 0 south of centre gives u = −dpdy/(ρ f) < 0 (westward) south of a NH low... a NH low has cyclonic (counter-clockwise) flow: westward south of centre.
        let (u, _v) = geostrophic(0.0, 0.002, 1.2, 45.0); assert!(u < 0.0);
        let (u2, _v2) = geostrophic(0.0, 0.002, 1.2, -45.0); assert!(u2 > 0.0); // flips in the south
    }
    #[test] fn wind_is_capped() { let (u, v) = geostrophic(1.0, 1.0, 1.2, 1.0); assert!(u.hypot(v) <= MAX_WIND + 1e-9); }
    #[test] fn clouds_from_humidity() { assert_eq!(cloud_fraction(0.5), 0.0); assert!((cloud_fraction(1.0) - 1.0).abs() < 1e-12); assert!(cloud_fraction(0.9) > 0.0 && cloud_fraction(0.9) < 1.0); }
    #[test] fn optical_depth_of_overcast_is_about_a_dozen() { let t = cloud_optical_depth(1.0); assert!(t > 5.0 && t < 30.0, "{}", t); }
    #[test] fn superheat_is_unstable() { assert!(vertical_instability(35.0, 25.0) > 0.0); assert!(vertical_instability(20.0, 20.0) < 0.0); }
}
