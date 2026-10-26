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
/// Held & Suarez (1994, Bull. Amer. Meteor. Soc. 75:1825) Newtonian rates, day^-1: k_a in the free troposphere, k_s at the surface.
/// At σ = 1 their k_T is k_a + (k_s − k_a) cos^4 φ.
pub const HS_KA_PER_DAY: f64 = 1.0 / 40.0;
pub const HS_KS_PER_DAY: f64 = 0.25;
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

/// Surface damping time of Held & Suarez (1994) at this latitude, seconds. k_T(σ=1) = k_a + (k_s − k_a) cos^4 φ.
pub fn held_suarez_surface_tau_s(lat_deg: f64) -> f64 {
    let c4 = lat_deg.to_radians().cos().powi(4);
    let k = HS_KA_PER_DAY + (HS_KS_PER_DAY - HS_KA_PER_DAY) * c4;
    86400.0 / k
}

/// Speed of the friction-reduced geostrophic wind of the annual pressure belts, m/s.
/// Density is the ISO 2533 sea-level standard (15 °C, `P0`, `RD`), the same standard the lapse rate uses.
pub fn belt_wind_m_s(lat_deg: f64) -> f64 {
    let half = 5.0;
    let dpdy = (belt_pressure(lat_deg + half) - belt_pressure(lat_deg - half)) / ((2.0 * half).to_radians() * EARTH_RADIUS);
    let rho = P0 / (RD * (15.0 + 273.15));
    let (u, v) = geostrophic(0.0, dpdy, rho, lat_deg);
    u.hypot(v)
}

/// Typical daytime mixed-layer depth (Stull 1988, An Introduction to Boundary Layer Meteorology, Kluwer:
/// the convective boundary layer is of order 1 km). Not fitted to a station.
pub const ABL_DEPTH_M: f64 = 1000.0;
/// Wind-measurement height in the neutral bulk coefficient, the same 10 m as `surface_balance`'s ln(10/z0) (FAO-56 eq. 4)
/// and `WIND_REF_M` in the forest read.
pub const BULK_WIND_HEIGHT_M: f64 = 10.0;

/// E-folding distance of the ocean's seasonal anomaly in the air the surface feels, metres.
/// Steady advection–relaxation still gives exp(−x/L) (Hartmann 1994, ch. 11). The clock is the boundary layer, not the
/// Held & Suarez free-atmosphere time: τ = h / (C_H U), so L = U τ = h / C_H. C_H = κ² / ln(z_m/z0)² is the neutral
/// coefficient already in `surface_balance`. z0 is the forest roughness, because seeded land holds half a bucket and
/// `land_kind` then selects forest. U cancels, including at the equator where the belt wind is zero.
/// Held & Suarez τ stays in this file for the free atmosphere; it is not this length. At 50°N that τ made L ≈ 5400 km,
/// and no land in the Kenora latitude band is farther than about 500 km from the ocean, so every land cell stayed marine.
pub fn ocean_decay_length_m(_lat_deg: f64) -> f64 {
    let ch = KAPPA * KAPPA / (BULK_WIND_HEIGHT_M / crate::planet_fundamentals::surface::FOREST_Z0).ln().powi(2);
    ABL_DEPTH_M / ch
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
    #[test] fn ocean_decay_length_is_a_boundary_layer_fetch() {
        assert!((HS_KS_PER_DAY - 0.25).abs() < 1e-15 && (HS_KA_PER_DAY - 0.025).abs() < 1e-15);
        let (l0, l50) = (ocean_decay_length_m(0.0), ocean_decay_length_m(50.0));
        let ch = KAPPA * KAPPA / (BULK_WIND_HEIGHT_M / crate::planet_fundamentals::surface::FOREST_Z0).ln().powi(2);
        let expect = ABL_DEPTH_M / ch;
        eprintln!("ocean decay length equator {:.1} km, 50N {:.1} km, h/C_H {:.1} km", l0 / 1000.0, l50 / 1000.0, expect / 1000.0);
        assert!((l50 - expect).abs() < 1e-6 && (l0 - expect).abs() < 1e-6, "L {}", l50);
        // Order of an ABL fetch over forest roughness, not a station fit and not the old 5400 km free-atmosphere scale.
        assert!(expect > 10_000.0 && expect < 80_000.0, "fetch {}", expect);
    }
}
