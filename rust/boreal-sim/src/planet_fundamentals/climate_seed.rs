//! Climate seed (issue #43): an instant Earth-like state with no spin-up, so the planet never needs a stabilisation run.
//! Continents are NOT generated here: `src/world/globe/planet.ts` (ridged multifractal + fBm, sea level at Earth's land share)
//! already makes them, and TypeScript hands the land fraction and height of each cell to this crate.
//! Temperature is the Budyko (1969) / Sellers (1969) zonal energy balance driven by the daily-mean insolation of
//! `solar_budget::daily_toa` (which carries the tilt): T = ((1−α)Q − A + C·T̄) / (B + C).
//! Moved here from the crate root (T-0062). Albedo and the A, B longwave coefficients live in `energy/`.
use crate::consts::*;
pub use super::energy::albedo::{planetary_albedo, planetary_albedo_at};
pub use super::energy::longwave::{OLR_A, OLR_B};
use super::atmosphere::surface_pressure;
use super::energy::solar_budget::daily_toa;
use super::hydrosphere::qsat;
use super::surface::{LAND_HEATCAP, OCEAN_HEATCAP};

/// Meridional transport as relaxation to the global mean, C = 3.87 W/m²/K (Budyko 1969, Tellus 21:611, as used by North 1975) [verify].
pub const TRANSPORT_C: f64 = 3.87;
/// Initial relative humidity: global-mean near-surface RH ≈ 0.75 (Peixoto & Oort 1996, Physics of Climate) [verify].
pub const RH_SEED: f64 = 0.75;

/// Area-weighted global-mean temperature, °C, for a day of year (one fixed-point pass: α from the α=0.32 first guess).
pub fn global_mean_t(day: f64) -> f64 {
    let (mut sq, mut sw) = (0.0, 0.0);
    let n = 90;
    for i in 0..n {
        let lat = -90.0 + (i as f64 + 0.5) * 180.0 / n as f64;
        let w = (lat * std::f64::consts::PI / 180.0).cos();
        let q = daily_toa(day, lat);
        let t0 = (0.68 * q - OLR_A) / OLR_B; // zero-order, α = 0.32
        sq += (1.0 - planetary_albedo_at(t0, lat)) * q * w; sw += w;
    }
    (sq / sw - OLR_A) / OLR_B
}
/// Zonal-mean sea-level temperature for a day and latitude, given the global mean `t_bar`.
pub fn seed_temperature(day: f64, lat: f64, t_bar: f64) -> f64 {
    let q = daily_toa(day, lat);
    let t0 = (0.68 * q - OLR_A + TRANSPORT_C * t_bar) / (OLR_B + TRANSPORT_C);
    (((1.0 - planetary_albedo_at(t0, lat)) * q - OLR_A + TRANSPORT_C * t_bar) / (OLR_B + TRANSPORT_C)).max(-60.0)
}

/// Seasonal response of a column with heat capacity `c` (J/m²/K): a first-order system C dT/dt = −(B + C_tr)(T − T_eq) + forcing responds to the
/// annual cycle with amplitude 1/√(1+(ωτ)²) and a lag atan(ωτ)/ω, τ = C/(B + C_tr) (Hartmann 1994, ch. 11; North & Coakley 1979). This is why the
/// ocean's seasons are small and late and a continent's are large and in step with the Sun. `c` = surface capacity + the air column cp·ps/g ≈ 1.0e7.
pub const AIR_COLUMN_HEATCAP: f64 = 1.0e7;
pub fn damped_seed(day: f64, lat: f64, surface_heatcap: f64, annual_t_bar: f64) -> f64 {
    let w = 2.0 * std::f64::consts::PI / 365.0; // rad per day
    let tau_days = (surface_heatcap + AIR_COLUMN_HEATCAP) / (OLR_B + TRANSPORT_C) / 86400.0;
    let (d, lag) = (1.0 / (1.0 + (w * tau_days).powi(2)).sqrt(), (w * tau_days).atan() / w);
    let inst = |dd: f64| seed_temperature(dd, lat, annual_t_bar);
    let mean = (0..12).map(|k| inst(15.0 + 30.4 * k as f64)).sum::<f64>() / 12.0;
    mean + d * (inst(day - lag) - mean)
}
/// Annual-mean global temperature, °C (12 monthly samples).
pub fn annual_global_t() -> f64 { (0..12).map(|k| global_mean_t(15.0 + 30.4 * k as f64)).sum::<f64>() / 12.0 }

/// Share of the ocean's seasonal state felt at this cell. Open water is 1. Land is exp(−distance / L),
/// the steady solution of advection–relaxation (Hartmann 1994, ch. 11, carried inland). L is passed in
/// (`wind::ocean_decay_length_m`) so this file does not import the wind module.
pub fn maritime_weight(land: f64, coast_m: f64, decay_m: f64) -> f64 {
    if land < 0.5 { return 1.0; }
    if !(coast_m.is_finite() && decay_m.is_finite()) || decay_m <= 0.0 { return 0.0; }
    (-coast_m.max(0.0) / decay_m).exp()
}

/// Air temperature: ocean and land seeds from `damped_seed`, blended by `maritime_weight`, then the lapse on land.
pub fn maritime_air(day: f64, lat: f64, land: f64, elev_m: f64, coast_m: f64, decay_m: f64, t_bar: f64) -> f64 {
    let sea = damped_seed(day, lat, OCEAN_HEATCAP, t_bar);
    let land_t = damped_seed(day, lat, LAND_HEATCAP, t_bar);
    let w = maritime_weight(land, coast_m, decay_m);
    w * sea + (1.0 - w) * land_t - LAPSE * elev_m.max(0.0) * land.clamp(0.0, 1.0)
}

pub struct Seeded { pub t_air: f64, pub soil_mm: f64, pub snow_mm: f64, pub q: f64 }
/// One cell's initial state. `coast_m` is metres to open water and `decay_m` is the e-folding length.
/// Bucket half full on land is game calibration (Manabe 1969 starts from field capacity). Snow where the seed is below freezing.
pub fn seed_cell(day: f64, lat: f64, land: f64, elev_m: f64, t_bar: f64, coast_m: f64, decay_m: f64) -> Seeded {
    let t = maritime_air(day, lat, land, elev_m, coast_m, decay_m, t_bar);
    let p = surface_pressure(P0, elev_m.max(0.0), t);
    Seeded { t_air: t, soil_mm: if land > 0.5 { 0.5 * BUCKET_MM } else { 0.0 }, snow_mm: if land > 0.5 && t < 0.0 { SNOW_SEED_MM } else { 0.0 }, q: RH_SEED * qsat(t, p) }
}
pub const SNOW_SEED_MM: f64 = 30.0; // game calibration

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn tropics_and_mean_match_observed() { // Jones et al. 1999 (Rev. Geophys. 37:173): global 14 °C (1961-90); tropical (±10°) zonal mean ~26-27 °C (Peixoto & Oort 1992)
        let tb = annual_global_t(); let eq = (0..12).map(|k| seed_temperature(15.0 + 30.4 * k as f64, 0.0, tb)).sum::<f64>() / 12.0;
        eprintln!("annual mean {tb:.2} equator {eq:.2}"); assert!((tb - 14.5).abs() < 2.0, "mean {tb}"); assert!((eq - 26.0).abs() < 2.0, "equator {eq}");
    }
    #[test] fn global_mean_is_earthlike() { let t = global_mean_t(80.0); assert!(t > 8.0 && t < 20.0, "T̄ {}", t); }
    #[test] fn equator_warm_poles_cold() {
        let tb = global_mean_t(80.0);
        let (e, n, s) = (seed_temperature(80.0, 0.0, tb), seed_temperature(80.0, 85.0, tb), seed_temperature(80.0, -85.0, tb));
        assert!(e > 18.0 && e < 35.0, "equator {}", e); // North 1975 gets ~26 °C; the constant-albedo Budyko seed is ~5 K cool in the tropics (reported as a gap) assert!(n < -10.0 && s < -10.0, "poles {} {}", n, s);
    }
    #[test] fn ocean_seasons_are_small_land_seasons_large() {
        let tb = annual_global_t(); let amp = |hc: f64| damped_seed(172.0, 50.0, hc, tb) - damped_seed(355.0, 50.0, hc, tb);
        let (land, sea) = (amp(LAND_HEATCAP), amp(OCEAN_HEATCAP));
        assert!(land > 3.0 * sea.abs() && land > 20.0, "land {} sea {}", land, sea);
        assert!(sea.abs() < 10.0, "ocean mid-latitude seasonal swing is of order 5-10 K, got {}", sea);
    }
    #[test] fn seasons_follow_tilt() {
        let tb = global_mean_t(172.0);
        assert!(seed_temperature(172.0, 60.0, tb) > seed_temperature(355.0, 60.0, global_mean_t(355.0)) + 15.0);
    }
    #[test] fn ocean_softening_falls_with_distance_from_water() {
        let tb = annual_global_t();
        let decay = crate::planet_fundamentals::atmosphere::wind::ocean_decay_length_m(49.79);
        let range = |d: f64| maritime_air(196.0, 49.79, 1.0, 0.0, d, decay, tb) - maritime_air(15.0, 49.79, 1.0, 0.0, d, decay, tb);
        let (r0, r_half, r1, r4) = (range(0.0), range(0.5 * decay), range(decay), range(4.0 * decay));
        let sea = damped_seed(196.0, 49.79, OCEAN_HEATCAP, tb) - damped_seed(15.0, 49.79, OCEAN_HEATCAP, tb);
        let land = damped_seed(196.0, 49.79, LAND_HEATCAP, tb) - damped_seed(15.0, 49.79, LAND_HEATCAP, tb);
        eprintln!("seasonal range July-minus-January at 49.79N: coast {r0:.2} K, L/2 {r_half:.2}, L {r1:.2}, 4L {r4:.2}; ocean column {sea:.2}, land column {land:.2}; L {:.1} km", decay / 1000.0);
        assert!((r0 - sea).abs() < 1e-6, "a shoreline land cell matches the ocean column, got {r0} vs {sea}");
        assert!(r0 < r_half && r_half < r1 && r1 < r4, "{r0} {r_half} {r1} {r4}");
        assert!(r4 > (r0 + land) / 2.0, "four fetches are past halfway from the ocean column to the land column");
        // Published end members, not a fit. A miss is recorded; it is not forced.
        // Tofino A (coast) July 14.7 − January 5.3 = 9.4 K. Kenora A July 19.7 − January −16.0 = 35.7 K.
        // Environment and Climate Change Canada 1981–2010 daily averages, climate ids 1038205 and 6034075.
        let tofino = 14.7f64 - 5.3;
        let kenora = 19.7f64 - (-16.0);
        eprintln!("ECCC range Tofino {tofino:.1} K, Kenora {kenora:.1} K; game coast {r0:.1}, game 4L {r4:.1}");
        assert!((tofino - 9.4).abs() < 1e-9 && (kenora - 35.7).abs() < 1e-9);
    }
}
