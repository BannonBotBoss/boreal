//! Geostrophic wind and the wind update, split from `atmosphere_budget.rs` and `update_wind.rs` (T-0062, issue #46).
//! f = 2 Ω sin φ. Surface wind is a fraction of the geostrophic wind (Wallace & Hobbs 2006, §8.2).
use crate::consts::*;
use crate::grid::*;
use super::pressure::{belt_pressure, sea_level_pressure};

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

/// Sea-level pressure from the column temperature (hypsometric), then geostrophic balance with the Coriolis term.
pub fn update_wind(g: &mut Grid) {
    let (nlat, nlon) = (g.nlat, g.nlon);
    // sea-level pressure = climatological belt + the hypsometric anomaly of each cell from its zonal mean (heat lows over warm land, highs over cold)
    for i in 0..g.n { let ta = g.p(TAIR)[i] + LAPSE * g.p(ELEV)[i].max(0.0) * g.p(LAND)[i]; g.pm(PSL)[i] = sea_level_pressure(ta); } // reduced to sea level
    for r in 0..nlat { let row = r * nlon; let m: f64 = g.p(PSL)[row..row + nlon].iter().sum::<f64>() / nlon as f64;
        let belt = belt_pressure(g.p(LAT)[row]); for c in 0..nlon { let v = &mut g.pm(PSL)[row + c]; *v = belt + (*v - m); } }
    let dphi = std::f64::consts::PI / nlat as f64;
    let dlam = 2.0 * std::f64::consts::PI / nlon as f64;
    for r in 0..nlat {
        let lat = g.p(LAT)[r * nlon];
        let coslat = (lat * std::f64::consts::PI / 180.0).cos().max(0.02);
        let dx = EARTH_RADIUS * coslat * dlam * 2.0; let dy = EARTH_RADIUS * dphi * 2.0;
        for c in 0..nlon {
            let (e, w) = (r * nlon + (c + 1) % nlon, r * nlon + (c + nlon - 1) % nlon);
            let (nn, ss) = (if r + 1 < nlat { (r + 1) * nlon + c } else { r * nlon + c }, if r > 0 { (r - 1) * nlon + c } else { r * nlon + c });
            let psl = g.p(PSL);
            let dpdx = (psl[e] - psl[w]) / dx;
            // rows run south → north, so row+1 is north
            let dpdy = (psl[nn] - psl[ss]) / if r == 0 || r + 1 == nlat { dy / 2.0 } else { dy };
            let i = r * nlon + c;
            let rho = P0 / (RD * (g.p(TAIR)[i] + 273.15));
            let (u, v) = geostrophic(dpdx, dpdy, rho, lat);
            g.pm(U)[i] = u; g.pm(V)[i] = v;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::pressure::belt_pressure;
    #[test] fn belts_make_trades_and_westerlies() {
        let dp = |a: f64, b: f64| (belt_pressure(b) - belt_pressure(a)) / ((b - a).to_radians() * EARTH_RADIUS);
        let (u15, _) = geostrophic(0.0, dp(10.0, 20.0), 1.2, 15.0); let (u45, _) = geostrophic(0.0, dp(40.0, 50.0), 1.2, 45.0);
        assert!(u15 < 0.0 && u45 > 0.0, "{} {}", u15, u45); // easterly trades, westerlies
    }
    #[test] fn coriolis_sign_and_size() { assert!((coriolis(45.0) - 1.0313e-4).abs() < 2e-7); assert!(coriolis(-30.0) < 0.0); }
    #[test] fn wind_circles_a_low_counter_clockwise_in_north() {
        let (u, _v) = geostrophic(0.0, 0.002, 1.2, 45.0); assert!(u < 0.0);
        let (u2, _v2) = geostrophic(0.0, 0.002, 1.2, -45.0); assert!(u2 > 0.0); // flips in the south
    }
    #[test] fn wind_is_capped() { let (u, v) = geostrophic(1.0, 1.0, 1.2, 1.0); assert!(u.hypot(v) <= MAX_WIND + 1e-9); }
}
