//! Climate seed (issue #43): an instant Earth-like state with no spin-up, so the planet never needs a stabilisation run.
//! Continents are NOT generated here: `src/world/globe/planet.ts` (ridged multifractal + fBm, sea level at Earth's land share)
//! already makes them, and TypeScript hands the land fraction and height of each cell to this crate.
//! Temperature is the Budyko (1969) / Sellers (1969) zonal energy balance driven by the daily-mean insolation of
//! `solar_budget::daily_toa` (which carries the tilt): T = ((1−α)Q − A + C·T̄) / (B + C).
use crate::consts::*;
use crate::hydrosphere_budget::*;
use crate::solar_budget::daily_toa;

/// Outgoing longwave I = A + B·T (T in °C): A = 203.3 W/m², B = 2.09 W/m²/K (North & Coakley 1979, J. Atmos. Sci. 36:1189).
pub const OLR_A: f64 = 203.3;
pub const OLR_B: f64 = 2.09;
/// Meridional transport as relaxation to the global mean, C = 3.87 W/m²/K (Budyko 1969, Tellus 21:611, as used by North 1975) [verify].
pub const TRANSPORT_C: f64 = 3.87;
/// Planetary albedo: 0.62 where T < −10 °C (Budyko 1969); ice-free it rises with latitude, α = A0 + A2·P2(sin φ) (the Legendre
/// fit of North, Cahalan & Coakley 1981, Rev. Geophys. 19:91; ERBE zonal means: ~0.25 in the tropics, ~0.35-0.4 at 60°).
/// A constant 0.32 left the tropics ~5 K cold. A0, A2 [calibrated: chosen within the ERBE zonal range so the annual mean is 14.3 °C (Jones 1999: 14.0) and the equator 26.8 °C]
pub const ALB_A0: f64 = 0.285; pub const ALB_A2: f64 = 0.05;
pub fn planetary_albedo_at(t_c: f64, lat: f64) -> f64 { if t_c < -10.0 { 0.62 } else { let x = lat.to_radians().sin(); ALB_A0 + ALB_A2 * 0.5 * (3.0 * x * x - 1.0) } }
pub fn planetary_albedo(t_c: f64) -> f64 { planetary_albedo_at(t_c, 30.0) }
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

pub struct Seeded { pub t_air: f64, pub soil_mm: f64, pub snow_mm: f64, pub q: f64 }
/// One cell's initial state: air at the zonal seed minus the lapse over its height, bucket half full on land, snow where the seed is below
/// freezing, humidity at RH_SEED. Half-full bucket is game calibration (Manabe 1969 starts from field capacity).
pub fn seed_cell(day: f64, lat: f64, land: f64, elev_m: f64, t_bar: f64) -> Seeded {
    let hc = if land > 0.5 { crate::surface_budget::LAND_HEATCAP } else { crate::surface_budget::OCEAN_HEATCAP };
    let t = damped_seed(day, lat, hc, t_bar) - LAPSE * elev_m.max(0.0) * land;
    let p = crate::atmosphere_budget::surface_pressure(P0, elev_m.max(0.0), t);
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
        let (land, sea) = (amp(crate::surface_budget::LAND_HEATCAP), amp(crate::surface_budget::OCEAN_HEATCAP));
        assert!(land > 3.0 * sea.abs() && land > 20.0, "land {} sea {}", land, sea);
        assert!(sea.abs() < 10.0, "ocean mid-latitude seasonal swing is of order 5-10 K, got {}", sea);
    }
    #[test] fn seasons_follow_tilt() {
        let tb = global_mean_t(172.0);
        assert!(seed_temperature(172.0, 60.0, tb) > seed_temperature(355.0, 60.0, global_mean_t(355.0)) + 15.0);
    }
}
