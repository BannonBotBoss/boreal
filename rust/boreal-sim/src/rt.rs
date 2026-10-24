//! Stage 4 (T-0070): shortwave radiative transfer fed by the gas field. column_budget.rs (Lacis & Hansen 1974) does the
//! transfer; here its inputs come from gas.rs instead of constants: ozone column (DU -> atm-cm), precipitable water and the
//! Rayleigh optical depth (number column above the surface relative to the US76 sea-level column), all integrated from n(z).
//! TSI: 1360.8 W/m2 at solar minimum (Kopp & Lean 2011, GRL 38:L01706) + the 11-yr cycle, ~1.0 W/m2 minimum-to-maximum
//! (Kopp 2016, J. Space Weather Space Clim. 6:A30), last minimum 2019.96 (NOAA SWPC / SILSO).
//! Surface albedo: open ocean direct-beam albedo 0.037/(1.1 mu^1.4 + 0.15) (Taylor et al. 1996, QJRMS 122:839, fitted to
//! aircraft data that include the Cox-Munk glint); glint radiance factor from Cox & Munk 1954 (JOSA 44:838) slope statistics,
//! sigma^2 = 0.003 + 0.00512 w, Fresnel n = 1.34; sea ice 0.6 (Perovich et al. 2002, bare/melting 0.5-0.7), fresh snow 0.8
//! (Warren 1982), land 0.2 (MODIS snow-free global mean ~0.2, Schaaf et al. 2002) unless the sim gives one.
use crate::{column_budget as cb, gas};
use std::sync::OnceLock;

pub fn tsi(year: f64) -> f64 { 1360.8 + 0.5 * (1.0 - (2.0 * std::f64::consts::PI * (year - 2019.96) / 11.0).cos()) }
pub fn ocean_albedo(mu: f64) -> f64 { 0.037 / (1.1 * mu.max(0.0).powf(1.4) + 0.15) }
fn fresnel(ci: f64, n: f64) -> f64 { let si = (1.0 - ci * ci).max(0.0).sqrt(); let st = si / n; let ct = (1.0 - st * st).max(0.0).sqrt();
    let rs = ((ci - n * ct) / (ci + n * ct)).powi(2); let rp = ((ct - n * ci) / (ct + n * ci)).powi(2); 0.5 * (rs + rp) }
/// Cox-Munk sun glint, bidirectional reflectance factor for sun (mu_s), view (mu_v), relative azimuth phi (rad, 0 = forward
/// scatter toward the sun's mirror point is phi = pi), wind speed w m/s at 12.5 m.
pub fn glint(mu_s: f64, mu_v: f64, phi: f64, w: f64) -> f64 { if mu_s <= 0.0 || mu_v <= 0.0 { return 0.0; }
    let s2 = 0.003 + 0.00512 * w; let (ss, sv) = ((1.0 - mu_s * mu_s).sqrt(), (1.0 - mu_v * mu_v).sqrt());
    let cos2w = mu_s * mu_v + ss * sv * phi.cos(); // cos of the scattering angle supplement: 2w = angle between sun and view
    let ci = ((1.0 + cos2w) / 2.0).max(0.0).sqrt(); let mu_n = (mu_s + mu_v) / (2.0 * ci); let tan2b = (1.0 - mu_n * mu_n) / (mu_n * mu_n);
    let p = (-tan2b / s2).exp() / (std::f64::consts::PI * s2); std::f64::consts::PI * fresnel(ci, 1.34) * p / (4.0 * mu_s * mu_v * mu_n.powi(4)) }
#[derive(Clone, Copy, PartialEq, Eq, Debug)] pub enum Surf { Ocean = 0, SeaIce = 1, Snow = 2, Land = 3 }
pub fn surface_albedo(s: Surf, mu: f64, land: f64) -> f64 { match s { Surf::Ocean => ocean_albedo(mu), Surf::SeaIce => 0.6, Surf::Snow => 0.8, Surf::Land => land } }
/// Inputs from the gas field at a surface altitude h km and surface humidity q.
#[derive(Clone, Copy, Debug)] pub struct GasInputs { pub ozone_cm: f64, pub pw_mm: f64, pub ray: f64 }
fn n0() -> f64 { static N: OnceLock<f64> = OnceLock::new(); *N.get_or_init(|| gas::column_above(0.0, 0.0, crate::constants::CO2_ppm_present).n_col) }
pub fn gas_inputs(h: f64, q: f64, co2: f64) -> GasInputs { let a = gas::column_above(h, q, co2); GasInputs { ozone_cm: a.o3_du / 1000.0, pw_mm: a.pw_mm, ray: a.n_col / n0() } }
pub fn point(toa: f64, mu: f64, cloud: f64, tau: f64, alpha: f64, g: &GasInputs) -> cb::Column { cb::column_with(toa, mu, cloud, tau, g.pw_mm, alpha, g.ozone_cm, g.ray) }

#[cfg(test)]
mod tests { use super::*; use crate::solar_budget::solar;
    #[test] fn tsi_cycle() { assert!((tsi(2019.96) - 1360.8).abs() < 1e-9); assert!((tsi(2025.46) - 1361.8).abs() < 1e-6); }
    #[test] fn ocean_and_glint() { assert!((ocean_albedo(1.0) - 0.0296).abs() < 0.001); assert!(ocean_albedo(0.2) > 0.12); // Taylor 1996 Fig.
        let spec = glint(0.8, 0.8, std::f64::consts::PI, 5.0); let off = glint(0.8, 0.8, 0.0, 5.0); assert!(spec > 0.2 && off < 1e-3, "glint {spec} {off}");
        assert!((fresnel(1.0, 1.34) - 0.0211).abs() < 5e-4); }
    #[test] fn gas_fed_inputs() { let g = gas_inputs(0.0, 0.0115, crate::constants::CO2_ppm_present); assert!((g.ozone_cm - 0.264).abs() < 0.015 && (g.ray - 1.0).abs() < 0.01 && (g.pw_mm - 25.0).abs() < 4.0, "{g:?}");
        let hi = gas_inputs(5.0, 0.0115, 422.8); assert!((hi.ray - 0.53).abs() < 0.03, "ray at 5 km {}", hi.ray); }
    /// Global annual mean from gas-fed inputs, a surface mix by latitude (ocean 71 %, land 29 %; snow/ice poleward of 70 deg)
    /// and climatological cloud (0.67, tau 3.6 as column_budget's test): Trenberth et al. 2009 / CERES EBAF within 10 %.
    #[test] fn global_mean_matches_ceres() { let g = gas_inputs(0.0, 0.0115, crate::constants::CO2_ppm_present);
        let (mut toa, mut r, mut aa, mut asf, mut w) = (0.0, 0.0, 0.0, 0.0, 0.0);
        for d in (0..365).step_by(5) { for la in (-89..90).step_by(2) { let c = (la as f64).to_radians().cos(); for h in 0..48 {
            let s = solar(d as f64 + 1.0, h as f64 * 0.5, la as f64, 0.0, 0.0); if s.toa <= 0.0 { w += c; continue; }
            let toa_s = s.toa * tsi(2020.0) / crate::constants::TSI;
            let surf: [(f64, f64); 2] = if (la as f64).abs() > 70.0 { [(0.5, 0.6), (0.5, 0.8)] } else { [(0.71, ocean_albedo(s.cos_z)), (0.29, 0.2)] };
            for (f, al) in surf { let k = point(toa_s, s.cos_z, 0.67, 3.6, al, &g); toa += f * k.toa * c; r += f * (k.refl_atm + k.refl_surf) * c; aa += f * k.abs_atm * c; asf += f * k.abs_surf * c; } w += c; } } }
        let (toa, r, aa, asf) = (toa / w, r / w, aa / w, asf / w); eprintln!("toa {toa:.1} refl {r:.1} atm {aa:.1} surf {asf:.1}");
        assert!((r / 100.0 - 1.0).abs() < 0.1 && (aa / 78.0 - 1.0).abs() < 0.1 && (asf / 161.0 - 1.0).abs() < 0.1, "refl {r} atm {aa} surf {asf}"); }
}
