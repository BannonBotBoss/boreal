//! Solar energy budget per surface cell (issue #43, item 1). Ported line for line from `solar()`, `shortwave()` and the
//! longwave term of `surfaceBalance()` in `src/core/weather.ts`; `tests/planet-budget.test.ts` checks the wasm against the
//! TypeScript to 1e-9 so the two cannot drift. Longwave helpers live in `longwave.rs` (T-0062).
use crate::consts::*;
pub use super::longwave::atmospheric_emissivity;
use super::longwave::{longwave_net, surface_emission};

const RAD: f64 = std::f64::consts::PI / 180.0;

#[derive(Clone, Copy, Debug)]
pub struct Sun { pub decl: f64, pub eqtime: f64, pub solar_hour: f64, pub zenith: f64, pub cos_z: f64, pub toa: f64 }

/// NOAA General Solar Position Calculations (NOAA GML, after Spencer 1971). The declination carries Earth's tilt; the hour
/// angle carries time of day; `(r0/r)²` carries the orbit. `local_hour` is in the zone `tz` hours from UTC.
pub fn solar(day_of_year: f64, local_hour: f64, lat: f64, lon: f64, tz: f64) -> Sun {
    let g = 2.0 * std::f64::consts::PI / 365.0 * (day_of_year - 1.0 + (local_hour - 12.0) / 24.0);
    let eqtime = 229.18 * (0.000075 + 0.001868 * g.cos() - 0.032077 * g.sin() - 0.014615 * (2.0 * g).cos() - 0.040849 * (2.0 * g).sin());
    let decl = 0.006918 - 0.399912 * g.cos() + 0.070257 * g.sin() - 0.006758 * (2.0 * g).cos() + 0.000907 * (2.0 * g).sin()
        - 0.002697 * (3.0 * g).cos() + 0.00148 * (3.0 * g).sin();
    let tst = local_hour * 60.0 + eqtime + 4.0 * lon - 60.0 * tz;
    let ha = (tst / 4.0 - 180.0) * RAD;
    let phi = lat * RAD;
    let cos_z = phi.sin() * decl.sin() + phi.cos() * decl.cos() * ha.cos();
    let r2 = 1.000110 + 0.034221 * g.cos() + 0.001280 * g.sin() + 0.000719 * (2.0 * g).cos() + 0.000077 * (2.0 * g).sin(); // (r0/r)² (Spencer 1971)
    Sun { decl: decl / RAD, eqtime, solar_hour: tst / 60.0, zenith: cos_z.clamp(-1.0, 1.0).acos() / RAD, cos_z, toa: (S0 * r2 * cos_z).max(0.0) }
}

/// Surface shortwave: clear-sky beam+diffuse transmittance 0.7^(AM^0.678) (Meinel & Meinel 1976, via Laue 1970) × 1.1 for
/// diffuse, Kasten & Young (1989) air mass, cloud attenuation 1 − 0.75 C^3.4 (Kasten & Czeplak 1980, Solar Energy 24:177).
pub fn shortwave(cos_z: f64, cloud: f64, s0r: f64) -> f64 {
    if cos_z <= 0.0 { return 0.0; }
    let z = cos_z.acos() / RAD;
    let am = 1.0 / (cos_z + 0.50572 * (96.07995 - z).powf(-1.6364));
    1.1 * s0r * cos_z * 0.7_f64.powf(am.powf(0.678)) * (1.0 - 0.75 * cloud.powf(3.4))
}

/// Instantaneous energy balance of one cell, W/m².
#[derive(Clone, Copy, Debug, Default)]
pub struct SolarBudget { pub toa: f64, pub sw_down: f64, pub q_absorbed: f64, pub q_reflected: f64, pub q_longwave_out: f64, pub lw_net: f64 }

/// Q_absorbed = (1−α) S↓, Q_reflected = α S↓. Longwave terms are `longwave.rs`.
pub fn budget(sun: &Sun, cloud: f64, albedo: f64, t_surface_c: f64, e_pa: f64) -> SolarBudget {
    let sw = shortwave(sun.cos_z, cloud, S0);
    SolarBudget { toa: sun.toa, sw_down: sw, q_absorbed: (1.0 - albedo) * sw, q_reflected: albedo * sw,
        q_longwave_out: surface_emission(t_surface_c), lw_net: longwave_net(e_pa, t_surface_c, cloud) }
}

/// Daily-mean top-of-atmosphere insolation (Berger 1978; Hartmann 1994, Global Physical Climatology, eq. 2.3):
/// Q = S0/π (r0/r)² (h0 sinφ sinδ + cosφ cosδ sin h0). Used by the climate seed.
pub fn daily_toa(day_of_year: f64, lat: f64) -> f64 {
    let s = solar(day_of_year, 12.0, lat, 0.0, 0.0);
    let (phi, d) = (lat * RAD, s.decl * RAD);
    let x = -phi.tan() * d.tan();
    let h0 = if x >= 1.0 { 0.0 } else if x <= -1.0 { std::f64::consts::PI } else { x.acos() };
    let g = 2.0 * std::f64::consts::PI / 365.0 * (day_of_year - 1.0);
    let r2 = 1.000110 + 0.034221 * g.cos() + 0.001280 * g.sin() + 0.000719 * (2.0 * g).cos() + 0.000077 * (2.0 * g).sin();
    S0 / std::f64::consts::PI * r2 * (h0 * phi.sin() * d.sin() + phi.cos() * d.cos() * h0.sin())
}

#[cfg(test)]
mod tests {
    use super::*;
    // Golden values from src/core/weather.ts run under tsx: solar(227, 12, 49.79, -94.36, -6), shortwave(.8, .3), shortwave(.2, 0).
    #[test] fn solar_matches_typescript() {
        let s = solar(227.0, 12.0, 49.79, -94.36, -6.0);
        assert!((s.cos_z - 0.8112594631176723).abs() < 1e-12, "{}", s.cos_z);
        assert!((s.toa - 1075.7495522740137).abs() < 1e-8);
        assert!((shortwave(0.8, 0.3, S0) - 781.2093559893306).abs() < 1e-8);
        assert!((shortwave(0.2, 0.0, S0) - 105.22072391510733).abs() < 1e-8);
    }
    #[test] fn night_has_no_sun() { assert_eq!(shortwave(-0.1, 0.0, S0), 0.0); }
    #[test] fn tilt_gives_polar_day_and_night() {
        assert!(daily_toa(172.0, 85.0) > 400.0, "June pole {}", daily_toa(172.0, 85.0));
        assert!(daily_toa(355.0, 85.0) < 1.0);
        // annual mean over the globe is S0/4 = 340 W/m² (the definition of the geometry)
        let m: f64 = (0..365).map(|d| { (0..180).map(|i| { let lat = -89.5 + i as f64; daily_toa(d as f64 + 1.0, lat) * (lat * RAD).cos() }).sum::<f64>() / (0..180).map(|i| (( -89.5 + i as f64) * RAD).cos()).sum::<f64>() }).sum::<f64>() / 365.0;
        assert!((m - S0 / 4.0).abs() < 2.0, "global mean {}", m);
    }
    #[test] fn clouds_attenuate() { assert!(shortwave(0.8, 1.0, S0) < 0.3 * shortwave(0.8, 0.0, S0)); }
    #[test] fn albedo_splits_energy() {
        let s = solar(172.0, 12.0, 0.0, 0.0, 0.0);
        let b = budget(&s, 0.0, 0.3, 15.0, 1000.0);
        assert!((b.q_absorbed + b.q_reflected - b.sw_down).abs() < 1e-9);
        assert!(b.lw_net < 0.0);
    }
}
