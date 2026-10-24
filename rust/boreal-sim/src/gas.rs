//! Gas column of a body as a function of altitude h above its mean surface (Matt: "allow for the modelling of gases").
//! One source for T, p, rho, number density and species mixing ratios; g(r) = G M / r^2 with G from constants.rs (CODATA)
//! and M = GM / G (JPL DE440 GM values), so G stays upstream. Hydrostatic balance with the local scale height H = kT/(m g).
//! Earth: U.S. Standard Atmosphere 1976 (NOAA/NASA/USAF, public domain): T on geopotential height to 86 km (7 layers),
//! 86-91 km 186.87 K, the US76 eq. 27 ellipse (Tc 263.1905, A -76.3232, a -19.9429 km) to 240 K at 110 km, +12 K/km to 360 K at 120 km, then
//! T = 1000 - 640 exp(-0.01875 (z - 120)) (US76 eq. 31, T_inf = 1000 K). Well mixed (N2 .78084, O2 .209476, Ar .00934, CO2 seed)
//! below the homopause; above 86 km each species follows its own scale height (diffusive separation, US76 sec. 1.3; thermal
//! diffusion and eddy mixing neglected [approx]); atomic O from 86 km (8.6e16 m^-3, US76 Table VIII) rising to 4.4e17 at 97 km
//! [approx], diffusive above. H2O: surface q from the sim, e-folding 2 km (Weaver & Ramanathan 1995) to a 4 ppmv stratospheric
//! floor (SPARC 2000). O3: AFGL U.S. Standard mixing-ratio profile (Anderson et al. 1986, AFGL-TR-86-0110, 0-120 km), log-interpolated.
//! NRLMSIS 2.0 is not used: its licence forbids modification and non-academic use (NRL-SOF-014-1).
//! Venus: VIRA (Seiff et al. 1985, Adv. Space Res. 5:3) temperatures, 92.1 bar surface, CO2 .965 / N2 .035.
//! Mercury: surface-bounded exosphere, Na 1e10 m^-3 / He 6e9 m^-3 at the surface (Killen et al. 2007, Space Sci. Rev. 132:433) [approx].
use crate::constants as C;
use std::sync::OnceLock;

#[derive(Clone, Copy, PartialEq, Eq, Debug)] pub enum Body { Earth = 0, Venus = 1, Mercury = 2 }
/// Species order in mixing-ratio outputs.
pub const SPECIES: [&str; 9] = ["N2", "O2", "Ar", "CO2", "H2O", "O3", "O", "Na", "He"];
const AMU: [f64; 9] = [28.0134, 31.9988, 39.948, 44.0095, 18.0153, 47.9982, 15.9994, 22.98977, 4.002602]; // g/mol (IUPAC)
/// GM (m^3/s^2, JPL DE440: Park et al. 2021) and mean radius (m, IAU WGCCRE 2015).
pub fn body_gm_r(b: Body) -> (f64, f64) { match b { Body::Earth => (C::G * C::M_earth /* = GM_earth */, C::R_earth_mean), Body::Venus => (3.24858592e14, 6.0518e6), Body::Mercury => (2.2031868551e13, 2.4397e6) } }
/// Effective gravity normal to the surface at geodetic latitude (deg), sea level: Newtonian G M / r^2 with the J2 term and the
/// centrifugal term omega^2 r cos^2(lat) (WGS84 a, f, omega; J2 EGM2008), r on the WGS84 ellipsoid.
pub fn g_eff_earth(lat_deg: f64) -> f64 { let p = lat_deg.to_radians(); let (a, b) = (C::wgs84_a, C::wgs84_a * (1.0 - C::wgs84_f));
    let r = ((a * a * p.cos()).powi(2) + (b * b * p.sin()).powi(2)).sqrt() / ((a * p.cos()).powi(2) + (b * p.sin()).powi(2)).sqrt();
    let s2 = p.sin().powi(2); let gr = C::GM_earth / (r * r) * (1.0 - 1.5 * C::J2_earth * (a / r).powi(2) * (3.0 * s2 - 1.0));
    gr - C::omega_earth.powi(2) * r * p.cos().powi(2) }
pub fn g_at(b: Body, h_m: f64) -> f64 { let (gm, r) = body_gm_r(b); gm / (r + h_m).powi(2) }
#[derive(Clone, Copy, Debug)] pub struct Col { pub t: f64, pub p: f64, pub rho: f64, pub n: f64, pub x: [f64; 9] }

const US76: [(f64, f64, f64); 7] = [(0.0, 288.15, -6.5), (11.0, 216.65, 0.0), (20.0, 216.65, 1.0), (32.0, 228.65, 2.8), (47.0, 270.65, 0.0), (51.0, 270.65, -2.8), (71.0, 214.65, -2.0)];
const R0_US76: f64 = 6356.766; // km, US76 geopotential reference radius
/// Earth temperature (K) at geometric altitude z km.
pub fn t_earth(z: f64) -> f64 {
    if z < 86.0 { let hp = R0_US76 * z / (R0_US76 + z); let b = US76.iter().rev().find(|b| hp >= b.0).unwrap_or(&US76[0]); return b.1 + b.2 * (hp - b.0); }
    if z < 91.0 { 186.87 } else if z < 110.0 { 263.1905 - 76.3232 * (1.0 - ((z - 91.0) / 19.9429).powi(2)).max(0.0).sqrt() /* US76 eq. 27 ellipse */ } else if z < 120.0 { 240.0 + 12.0 * (z - 110.0) } else { 1000.0 - 640.0 * (-0.01875 * (z - 120.0)).exp() }
}
const VIRA: [(f64, f64); 11] = [(0.0, 735.3), (10.0, 658.2), (20.0, 580.7), (30.0, 496.9), (40.0, 417.6), (50.0, 350.5), (60.0, 262.8), (70.0, 229.8), (80.0, 197.1), (90.0, 169.4), (100.0, 175.4)];
pub fn t_venus(z: f64) -> f64 { for w in VIRA.windows(2) { if z <= w[1].0 { let f = ((z - w[0].0) / (w[1].0 - w[0].0)).max(0.0); return w[0].1 + f * (w[1].1 - w[0].1); } } 175.4 }

/// AFGL-TR-86-0110 U.S. Standard ozone volume mixing ratio (ppmv) at z km (Anderson et al. 1986).
const O3_AFGL: [(f64, f64); 40] = [(0.0, 2.66e-2), (1.0, 2.93e-2), (2.0, 3.24e-2), (3.0, 3.32e-2), (4.0, 3.39e-2), (5.0, 3.77e-2), (6.0, 4.11e-2), (7.0, 5.01e-2), (8.0, 5.97e-2), (9.0, 9.17e-2),
    (10.0, 1.31e-1), (11.0, 2.15e-1), (12.0, 3.10e-1), (13.0, 3.85e-1), (14.0, 5.03e-1), (15.0, 6.51e-1), (16.0, 8.70e-1), (17.0, 1.19), (18.0, 1.59), (19.0, 2.03), (20.0, 2.58), (21.0, 3.03), (22.0, 3.65), (23.0, 4.17), (24.0, 4.63), (25.0, 5.12),
    (27.5, 5.80), (30.0, 6.55), (32.5, 7.21), (35.0, 7.84), (37.5, 7.70), (40.0, 6.30), (42.5, 5.36), (45.0, 4.45), (47.5, 3.82), (50.0, 3.26), (60.0, 1.29), (70.0, 0.27), (80.0, 0.075), (100.0, 3.2e-3)];
pub fn o3_vmr(z: f64) -> f64 { if z >= 100.0 { return 0.0; } for w in O3_AFGL.windows(2) { if z <= w[1].0 { let f = ((z - w[0].0) / (w[1].0 - w[0].0)).max(0.0); return 1e-6 * (w[0].1.ln() * (1.0 - f) + w[1].1.ln() * f).exp(); } } 0.0 }
const DZ: f64 = 0.05; const ZTOP: f64 = 1000.0; // km
struct Tab { n: Vec<[f64; 9]> } // number densities per DZ for the dry, CO2 = 420 ppm reference
fn earth_tab() -> &'static Tab { static T: OnceLock<Tab> = OnceLock::new(); T.get_or_init(|| {
    let steps = (ZTOP / DZ) as usize; let mut out = Vec::with_capacity(steps + 1);
    let xs = [C::x_N2_dry, C::x_O2_dry, C::x_Ar_dry, C::CO2_ppm_present * 1e-6]; let mbar: f64 = xs.iter().zip(AMU).map(|(x, m)| x * m).sum::<f64>() / xs.iter().sum::<f64>() * 1e-3;
    let mut lnp = 101325.0f64.ln() /* US76 sea-level standard */; let mut ni = [0.0f64; 9];
    for k in 0..=steps { let z = k as f64 * DZ; let t = t_earth(z);
        if z <= 86.0 { let n = lnp.exp() / (C::k_B * t); let s: f64 = xs.iter().sum(); for j in 0..4 { ni[j] = n * xs[j] / s; }
            ni[8] = n * 5.24e-6; // He, well mixed 5.24 ppmv (US76 Table 3), carried in the diffusion above 86 km
            ni[6] = if z > 80.0 { 8.6e16 * ((z - 80.0) / 6.0) } else { 0.0 };
            let zm = z + DZ / 2.0; lnp -= mbar * g_at(Body::Earth, zm * 1e3) / (C::R * t_earth(zm)) * DZ * 1e3; }
        else { let zm = z - DZ / 2.0; let tm = t_earth(zm); let dlnt = t.ln() - t_earth(z - DZ).ln(); let g = g_at(Body::Earth, zm * 1e3);
            // US76 sec. 1.3.2 (eq. 36 without the O/H flux terms): each species relaxes from the eddy-mixed gradient (mean
            // molar mass M) to its own diffusive one with weight D_i/(D_i + K); K(z) US76 eq. 37-38, D_i = a_i/n (T/273.15)^b_i (Table 6)
            let nt: f64 = ni.iter().sum(); let mm: f64 = (0..9).map(|j| ni[j] * AMU[j]).sum::<f64>() / nt * 1e-3;
            let k_eddy = if zm < 95.0 { 120.0 } else if zm < 115.0 { 120.0 * (1.0 - 400.0 / (400.0 - (zm - 95.0).powi(2))).exp() } else { 0.0 };
            let mix = -(mm * g / (C::R * tm)) * DZ * 1e3 - dlnt;
            for j in [0usize, 1, 2, 3, 6, 8] { let (a, b) = match j { 1 => (4.863e20, 0.75), 2 => (4.487e20, 0.87), 6 => (6.986e20, 0.75), 8 => (1.7e21, 0.691), _ => (3.3e20, 0.75) /* N2, CO2: US76 has N2 as the background; O2-like value [approx] */ };
                let d = a / nt * (tm / 273.15).powf(b); let w = d / (d + k_eddy);
                let alpha = if j == 8 { -0.4 } else { 0.0 }; // thermal diffusion factor (US76 Table 6)
                ni[j] *= (w * (-(AMU[j] * 1e-3 * g / (C::R * tm)) * DZ * 1e3 - (1.0 + alpha) * dlnt) + (1.0 - w) * mix).exp(); }
            if z <= 97.0 { ni[6] = 8.6e16 * (4.4e17f64 / 8.6e16).powf((z - 86.0) / 11.0); }
            // 97-120 km: O photochemistry and the downward O/O2 fluxes (US76 eq. 36 flux terms, not modelled) set O and O2; tie them
            // log-linearly to US76 Table VIII at 120 km (O 9.275e16, O2 4.395e16 m^-3); pure diffusion above (K = 0 above 115 km)
            else if z <= 120.0 { let f = (z - 97.0) / 23.0; ni[6] = 4.4e17 * (9.275e16f64 / 4.4e17).powf(f);
                if (z - 120.0).abs() < DZ / 2.0 { ni[1] = 4.395e16; } } }
        out.push(ni); }
    Tab { n: out } }) }
/// Gas column at altitude h (km above mean radius). `q_surf` kg/kg from the sim, `co2_ppm` from the climate seed.
pub fn column(b: Body, h: f64, q_surf: f64, co2_ppm: f64) -> Col {
    let mut x = [0.0f64; 9]; let h = h.max(0.0);
    match b {
        Body::Earth => { let t = t_earth(h.min(ZTOP)); let tb = earth_tab(); let f = (h.min(ZTOP) / DZ).min((tb.n.len() - 1) as f64); let i = f as usize; let a = f - i as f64;
            let j = (i + 1).min(tb.n.len() - 1); let mut ni = [0.0f64; 9]; for s in 0..9 { ni[s] = if tb.n[i][s] > 0.0 && tb.n[j][s] > 0.0 { (tb.n[i][s].ln() * (1.0 - a) + tb.n[j][s].ln() * a).exp() } else { tb.n[i][s] }; }
            ni[3] *= co2_ppm / C::CO2_ppm_present;
            let nd: f64 = ni.iter().sum(); let vmr_w = (q_surf * 28.9644 / 18.0153 * (-h / 2.0).exp()).max(if h > 12.0 && h < 86.0 { 4e-6 } else { 0.0 });
            ni[4] = nd * vmr_w; ni[5] = nd * o3_vmr(h);
            let n: f64 = ni.iter().sum(); for s in 0..9 { x[s] = ni[s] / n; }
            let m: f64 = (0..9).map(|s| x[s] * AMU[s]).sum::<f64>() * 1e-3; let p = n * C::k_B * t; Col { t, p, rho: p * m / (C::R * t), n, x } }
        Body::Venus => { let m = (0.965 * AMU[3] + 0.035 * AMU[0]) * 1e-3; let steps = (h / DZ).ceil() as usize; let dz = if steps > 0 { h / steps as f64 } else { 0.0 };
            let mut lnp = 92.1e5f64.ln(); for k in 0..steps { let zm = (k as f64 + 0.5) * dz; lnp -= m * g_at(b, zm * 1e3) / (C::R * t_venus(zm)) * dz * 1e3; }
            let t = t_venus(h); let p = lnp.exp(); x[3] = 0.965; x[0] = 0.035; Col { t, p, rho: p * m / (C::R * t), n: p / (C::k_B * t), x } }
        Body::Mercury => { let t = 600.0; let hs = |amu: f64| C::R * t / (amu * 1e-3 * g_at(b, 0.0)) / 1e3; // km
            let (na, he) = (1e10 * (-h / hs(AMU[7])).exp(), 6e9 * (-h / hs(AMU[8])).exp()); let n = na + he; x[7] = na / n; x[8] = he / n;
            let p = n * C::k_B * t; Col { t, p, rho: (na * AMU[7] + he * AMU[8]) * 1e-3 / C::N_A, n, x } }
    }
}

/// Normal gravity of the rotating oblate Earth at radius r (m) and geocentric latitude (deg): G M / r^2 with the J2 term and
/// the centrifugal term (same model as g_eff_earth, which it reproduces on the WGS84 ellipsoid). Valid outside the body.
pub fn gravity(r_m: f64, lat_deg: f64) -> f64 { let p = lat_deg.to_radians(); let s2 = p.sin().powi(2); let a = C::wgs84_a;
    C::GM_earth / (r_m * r_m) * (1.0 - 1.5 * C::J2_earth * (a / r_m).powi(2) * (3.0 * s2 - 1.0)) - C::omega_earth.powi(2) * r_m * p.cos().powi(2) }
/// Thermal layer from the US76 temperature structure (geometric h km): 0 troposphere (below the 11 km geopotential tropopause),
/// 1 stratosphere (to the 47 km stratopause), 2 mesosphere (to the 86 km mesopause), 3 thermosphere (to the exobase,
/// interior::EXOBASE_KM), 4 exosphere.
pub const ATM_LAYERS: [&str; 5] = ["troposphere", "stratosphere", "mesosphere", "thermosphere", "exosphere"];
pub fn atmos_layer(h: f64) -> usize { let hp = R0_US76 * h / (R0_US76 + h); if hp < 11.0 { 0 } else if hp < 47.0 { 1 } else if h < 86.0 { 2 } else if h < crate::interior::EXOBASE_KM { 3 } else { 4 } }
/// Column above altitude h km (to 1000 km): total number column (m^-2), ozone (Dobson units, 2.687e20 m^-2 each),
/// precipitable water (mm = kg/m^2) and air mass (kg/m^2).
#[derive(Clone, Copy, Debug)] pub struct Above { pub n_col: f64, pub o3_du: f64, pub pw_mm: f64, pub mass: f64 }
pub fn column_above(h: f64, q_surf: f64, co2_ppm: f64) -> Above { let dz = 0.05; let mut z = h.max(0.0); let mut a = Above { n_col: 0.0, o3_du: 0.0, pw_mm: 0.0, mass: 0.0 };
    while z < ZTOP { let c = column(Body::Earth, z + dz / 2.0, q_surf, co2_ppm); let d = dz * 1e3;
        a.n_col += c.n * d; a.o3_du += c.x[5] * c.n * d / 2.687e20; a.pw_mm += c.x[4] * c.n * d * AMU[4] * 1e-3 / C::N_A; a.mass += c.rho * d; z += dz; } a }
#[cfg(test)]
mod tests { use super::*;
    #[test] fn gravity_from_gm() { let g0 = g_at(Body::Earth, 0.0); assert!((g0 - 9.82).abs() < 0.005, "g(R_mean) {g0}"); assert!((g0 - C::g_earth_mean).abs() < 1e-9);
        let som = |l: f64| { let s2 = l.to_radians().sin().powi(2); 9.7803253359 * (1.0 + 0.00193185265241 * s2) / (1.0 - 0.00669437999013 * s2).sqrt() }; // WGS84 normal gravity (Somigliana, NGA TR8350.2 eq. 4-1)
        assert!((g_eff_earth(0.0) - 9.780).abs() < 0.002, "eq {}", g_eff_earth(0.0)); assert!((g_eff_earth(90.0) - 9.832).abs() < 0.002, "pole {}", g_eff_earth(90.0));
        for l in [0.0, 30.0, 45.0, 60.0, 90.0] { assert!((g_eff_earth(l) - som(l)).abs() < 0.002, "lat {l}: {} vs {}", g_eff_earth(l), som(l)); } }
    #[test] fn dry_air_from_graph() { let c = column(Body::Earth, 1.0, 0.0, C::CO2_ppm_present); assert!((c.x[0] - 0.78084).abs() < 2e-4 && (c.x[1] - 0.20946).abs() < 2e-4 && (c.x[2] - 0.00934).abs() < 2e-5);
        assert!((c.x[3] * 1e6 - 422.8).abs() < 1.0); assert!((column(Body::Earth, 1.0, 0.0, 280.0).x[3] * 1e6 - 280.0).abs() < 1.0); }
    /// U.S. Standard Atmosphere 1976, Table I (geometric altitude): z km, T K, p Pa, rho kg/m3.
    const TAB: [(f64, f64, f64, f64); 8] = [(0.0, 288.15, 101325.0, 1.2250), (5.0, 255.68, 54048.0, 0.73643), (11.0, 216.77, 22700.0, 0.36480), (20.0, 216.65, 5529.3, 0.088910),
        (32.0, 228.49, 889.06, 0.013555), (50.0, 270.65, 79.779, 1.0269e-3), (70.0, 219.58, 5.2209, 8.2829e-5), (86.0, 186.87, 0.37338, 6.958e-6)];
    #[test] fn ussa76_table() { for (z, t, p, rho) in TAB { let c = column(Body::Earth, z, 0.0, 420.0);
        assert!((c.t - t).abs() < 0.6, "T {z} {} vs {t}", c.t); assert!((c.p / p - 1.0).abs() < 0.02, "p {z} {} vs {p}", c.p); assert!((c.rho / rho - 1.0).abs() < 0.02, "rho {z} {} vs {rho}", c.rho); } }
    /// US76 Table I above 86 km (z, p Pa, rho kg/m3)
    #[test] fn ussa76_upper() { for (z, p, rho) in [(100.0, 3.2011e-2, 5.604e-7), (120.0, 2.5381e-3, 2.222e-8), (150.0, 4.5422e-4, 2.076e-9), (200.0, 8.4736e-5, 2.541e-10), (300.0, 8.7704e-6, 1.916e-11), (500.0, 3.0236e-7, 5.215e-13)] {
        let c = column(Body::Earth, z, 0.0, 420.0); assert!((c.p / p - 1.0).abs() < 0.04 && (c.rho / rho - 1.0).abs() < 0.04, "{z} km: p {:+.1}% rho {:+.1}%", (c.p / p - 1.0) * 100.0, (c.rho / rho - 1.0) * 100.0); } }
    #[test] fn gravity_layers_columns() { for l in [0.0f64, 45.0, 89.9] { let p = l.to_radians(); let (a, b) = (C::wgs84_a, C::wgs84_a * (1.0 - C::wgs84_f));
            let r = ((a * a * p.cos()).powi(2) + (b * b * p.sin()).powi(2)).sqrt() / ((a * p.cos()).powi(2) + (b * p.sin()).powi(2)).sqrt();
            let gc = (b * b / (a * a) * p.tan()).atan().to_degrees(); assert!((gravity(r, gc) - g_eff_earth(l)).abs() < 0.003, "{l}: {} {}", gravity(r, gc), g_eff_earth(l)); }
        assert_eq!(atmos_layer(5.0), 0); assert_eq!(atmos_layer(30.0), 1); assert_eq!(atmos_layer(70.0), 2); assert_eq!(atmos_layer(300.0), 3); assert_eq!(atmos_layer(700.0), 4);
        let a = column_above(0.0, 0.0115, C::CO2_ppm_present); // mass = p0/g (10332 kg/m2), O3 ~345 DU (AFGL US Std), pw ~25 mm (Trenberth et al. 2005 global mean)
        assert!((a.mass * C::g_earth_mean / 101325.0 - 1.0).abs() < 0.01, "mass {}", a.mass); assert!((a.o3_du - 345.0).abs() < 15.0, "DU {}", a.o3_du); assert!((a.pw_mm - 25.0).abs() < 4.0, "pw {}", a.pw_mm); }
    #[test] fn thermosphere_and_separation() { let c = column(Body::Earth, 300.0, 0.0, 420.0); // US76: rho(300 km) 1.916e-11, O dominant
        assert!(c.rho > 0.5 * 1.916e-11 && c.rho < 2.0 * 1.916e-11, "rho300 {}", c.rho); assert!(c.x[6] > c.x[0] && c.x[6] > 0.5, "O {}", c.x[6]);
        let lo = column(Body::Earth, 50.0, 0.0, 420.0); assert!((lo.x[0] - 0.7808).abs() < 0.002); }
    #[test] fn ozone_water_venus_mercury() { let mut s = 0.0; let mut z = 0.0; while z < 80.0 { s += column(Body::Earth, z, 0.0, 420.0).x[5] * column(Body::Earth, z, 0.0, 420.0).n * 100.0; z += 0.1; }
        let du = s / 2.687e20; assert!((du - 345.0).abs() < 15.0, "O3 {du} DU (AFGL US Standard ~345 DU)");
        assert!((column(Body::Earth, 0.0, 0.01, 420.0).x[4] - 0.0158).abs() < 0.002);
        let v = column(Body::Venus, 0.0, 0.0, 0.0); assert!((v.rho - 65.0).abs() < 5.0, "Venus rho0 {}", v.rho); let v50 = column(Body::Venus, 50.0, 0.0, 0.0); assert!(v50.p > 0.7e5 && v50.p < 1.4e5, "Venus p50 {}", v50.p);
        assert!(column(Body::Mercury, 0.0, 0.0, 0.0).p < 1e-8); }
}
