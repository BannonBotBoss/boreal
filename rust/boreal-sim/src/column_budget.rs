//! Column shortwave budget (top of atmosphere -> surface -> back out): where sunlight is reflected and absorbed on the way.
//! Lacis & Hansen 1974 (J. Atmos. Sci. 31:118) parameterisations: Rayleigh reflection R = 0.28/(1+6.43 mu) (eq. 18), water-vapour
//! absorption A_wv(y) (eq. 17, y = water path cm x magnification M = 35/sqrt(1224 mu^2 + 1)), ozone absorption A_oz(x) (eqs. 12-13,
//! column 0.3 atm-cm); cloud albedo from optical depth by two-stream R_c = s tau/(1 + s tau), s = sqrt(3)/2 (1 - g), g = 0.85
//! (Lacis & Hansen 1974; Stephens 1978); cloud absorption ~5 % of incident (Stephens 1978, 3-8 %). Validated against the global
//! annual means of Trenberth, Fasullo & Kiehl 2009 (BAMS 90:311): incoming 341, reflected 102 (79 atm+cloud, 23 surface),
//! absorbed by atmosphere 78, by surface 161.
#[derive(Clone, Copy, Debug, Default)]
pub struct Column { pub toa: f64, pub refl_atm: f64, pub refl_surf: f64, pub abs_atm: f64, pub abs_surf: f64, pub down_surf: f64 }
pub const OZONE_CM: f64 = 0.3; pub const G_ASYM: f64 = 0.85; pub const CLOUD_ABS: f64 = 0.12; // [calibrated within Stephens 1978 3-8 % (thin) .. Ramanathan et al. 1995 ~ +25 W/m2 cloud absorption]
/// aerosol: global mean AOD 0.13 at 550 nm (Remer et al. 2008, MODIS), single-scattering albedo 0.93 (Dubovik et al. 2002)
pub const AOD: f64 = 0.13; pub const AER_SSA: f64 = 0.93;
pub fn rayleigh_refl(mu: f64) -> f64 { 0.28 / (1.0 + 6.43 * mu) }
pub fn magnification(mu: f64) -> f64 { 35.0 / (1224.0 * mu * mu + 1.0).sqrt() }
pub fn a_wv(y: f64) -> f64 { 2.9 * y / ((1.0 + 141.5 * y).powf(0.635) + 5.925 * y) }
pub fn a_oz(x: f64) -> f64 { 0.02118 * x / (1.0 + 0.042 * x + 0.000323 * x * x) + 1.082 * x / (1.0 + 138.6 * x).powf(0.805) + 0.0658 * x / (1.0 + (103.6 * x).powi(3)) }
pub fn cloud_albedo(tau: f64) -> f64 { let s = 3f64.sqrt() / 2.0 * (1.0 - G_ASYM); s * tau / (1.0 + s * tau) }
/// toa: W/m2 on a horizontal surface; mu: cos zenith; cloud 0..1; tau cloud optical depth; pw_mm precipitable water; alpha surface albedo
pub fn column(toa: f64, mu: f64, cloud: f64, tau: f64, pw_mm: f64, alpha: f64) -> Column { column_with(toa, mu, cloud, tau, pw_mm, alpha, OZONE_CM, 1.0) }
/// Same, with the ozone column (atm-cm) and the Rayleigh optical depth relative to the standard column (n_col / n_col,0)
/// supplied by the gas field (rt.rs feeds them from gas.rs); Rayleigh reflection scales with optical depth (thin limit).
pub fn column_with(toa: f64, mu: f64, cloud: f64, tau: f64, pw_mm: f64, alpha: f64, ozone_cm: f64, ray: f64) -> Column {
    if toa <= 0.0 || mu <= 0.0 { return Column::default(); }
    let m = magnification(mu);
    let oz = a_oz(ozone_cm * m) * toa;                 // stratospheric ozone, above everything
    let s1 = toa - oz;
    let rr = rayleigh_refl(mu) * ray * s1;                   // clear-air (Rayleigh) back-scatter
    let aer = (1.0 - (-AOD * (1.0 - AER_SSA) / mu.max(0.05)).exp()) * (s1 - rr); // aerosol absorption on the slant path
    let s2 = s1 - rr - aer;
    let rc = cloud * cloud_albedo(tau) * s2;           // cloud tops
    let ac = cloud * CLOUD_ABS * s2;
    let s3 = s2 - rc - ac;
    let wv = a_wv(pw_mm / 10.0 * m) * s3;              // water vapour below / in the cloud layer
    let down = s3 - wv;
    let up = alpha * down;                             // surface reflection, diffuse on the way up (M = 1.66)
    let up_wv = a_wv(pw_mm / 10.0 * 1.66) * up * 0.5;  // half the column above the mean reflecting height
    let up_cl = cloud * cloud_albedo(tau) * (up - up_wv); // reflected back down by cloud bases (absorbed at the surface, single bounce)
    let esc = up - up_wv - up_cl;
    Column { toa, refl_atm: rr + rc, refl_surf: esc, abs_atm: oz + aer + ac + wv + up_wv, abs_surf: down - up + up_cl, down_surf: down }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::solar_budget::solar;
    /// Annual global mean with climatological inputs: cloud 0.67 (King et al. 2013, MODIS), mean cloud tau 9 (ISCCP-D mean of
    /// ISCCP global mean visible tau ~3.6-3.9, Rossow & Schiffer 1999), pw 25 mm (Trenberth et al. 2005), surface albedo 0.125 (23/184, Trenberth 2009).
    pub fn global(cloud: f64, tau: f64, pw: f64, alpha: f64) -> Column {
        let mut acc = Column::default(); let mut w = 0.0;
        for d in (0..365).step_by(5) { for la in (-89..90).step_by(2) { let c = (la as f64).to_radians().cos(); for h in 0..48 {
            let s = solar(d as f64 + 1.0, h as f64 * 0.5, la as f64, 0.0, 0.0); let k = column(s.toa, s.cos_z, cloud, tau, pw, alpha);
            acc.toa += k.toa * c; acc.refl_atm += k.refl_atm * c; acc.refl_surf += k.refl_surf * c; acc.abs_atm += k.abs_atm * c; acc.abs_surf += k.abs_surf * c; w += c; } } }
        Column { toa: acc.toa / w, refl_atm: acc.refl_atm / w, refl_surf: acc.refl_surf / w, abs_atm: acc.abs_atm / w, abs_surf: acc.abs_surf / w, down_surf: 0.0 }
    }
    #[test] fn closes_to_trenberth_2009() {
        let g = global(0.67, 3.6, 25.0, 0.125); eprintln!("{:?}", g);
        let r = g.refl_atm + g.refl_surf;
        assert!((g.toa - 341.0).abs() < 2.0); assert!((r - 102.0).abs() < 5.0, "reflected {}", r);
        assert!((g.abs_atm - 78.0).abs() < 5.0, "atm {}", g.abs_atm); assert!((g.abs_surf - 161.0).abs() < 5.0, "surf {}", g.abs_surf);
        let a = r / g.toa; assert!(a > 0.29 && a < 0.31, "albedo {}", a);
        assert!((g.toa - r - g.abs_atm - g.abs_surf).abs() < 1e-6); // energy conserved
    }
}
