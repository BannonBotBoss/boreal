//! Gas column of a body as a function of altitude h above its mean surface (Matt: "allow for the modelling of gases").
//! One source for T, p, rho, number density and species mixing ratios; g(r) = G M / r^2 with G from constants.rs (CODATA)
//! and M = GM / G (JPL DE440 GM values), so G stays upstream. Hydrostatic balance with the local scale height H = kT/(m g).
//! Earth: U.S. Standard Atmosphere 1976 (NOAA/NASA/USAF, public domain): T on geopotential height to 86 km (7 layers),
//! 86-91 km 186.87 K, linear to 240 K at 110 km [approx for the US76 ellipse], +12 K/km to 360 K at 120 km, then
//! T = 1000 - 640 exp(-0.01875 (z - 120)) (US76 eq. 31, T_inf = 1000 K). Well mixed (N2 .78084, O2 .209476, Ar .00934, CO2 seed)
//! below the homopause; above 86 km each species follows its own scale height (diffusive separation, US76 sec. 1.3; thermal
//! diffusion and eddy mixing neglected [approx]); atomic O from 86 km (8.6e16 m^-3, US76 Table VIII) rising to 4.4e17 at 97 km
//! [approx], diffusive above. H2O: surface q from the sim, e-folding 2 km (Weaver & Ramanathan 1995) to a 4 ppmv stratospheric
//! floor (SPARC 2000). O3: 5e18 m^-3 peak at 22 km, Gaussian 1/e half-width 8 km (Krueger & Minzner 1976 mid-latitude) = 264 DU.
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
    if z < 91.0 { 186.87 } else if z < 110.0 { 186.87 + (240.0 - 186.87) * (z - 91.0) / 19.0 } else if z < 120.0 { 240.0 + 12.0 * (z - 110.0) } else { 1000.0 - 640.0 * (-0.01875 * (z - 120.0)).exp() }
}
const VIRA: [(f64, f64); 11] = [(0.0, 735.3), (10.0, 658.2), (20.0, 580.7), (30.0, 496.9), (40.0, 417.6), (50.0, 350.5), (60.0, 262.8), (70.0, 229.8), (80.0, 197.1), (90.0, 169.4), (100.0, 175.4)];
pub fn t_venus(z: f64) -> f64 { for w in VIRA.windows(2) { if z <= w[1].0 { let f = ((z - w[0].0) / (w[1].0 - w[0].0)).max(0.0); return w[0].1 + f * (w[1].1 - w[0].1); } } 175.4 }

const DZ: f64 = 0.05; const ZTOP: f64 = 1000.0; // km
struct Tab { n: Vec<[f64; 9]> } // number densities per DZ for the dry, CO2 = 420 ppm reference
fn earth_tab() -> &'static Tab { static T: OnceLock<Tab> = OnceLock::new(); T.get_or_init(|| {
    let steps = (ZTOP / DZ) as usize; let mut out = Vec::with_capacity(steps + 1);
    let xs = [C::x_N2_dry, C::x_O2_dry, C::x_Ar_dry, C::CO2_ppm_present * 1e-6]; let mbar: f64 = xs.iter().zip(AMU).map(|(x, m)| x * m).sum::<f64>() / xs.iter().sum::<f64>() * 1e-3;
    let mut lnp = 101325.0f64.ln() /* US76 sea-level standard */; let mut ni = [0.0f64; 9];
    for k in 0..=steps { let z = k as f64 * DZ; let t = t_earth(z);
        if z <= 86.0 { let n = lnp.exp() / (C::k_B * t); let s: f64 = xs.iter().sum(); for j in 0..4 { ni[j] = n * xs[j] / s; }
            ni[6] = if z > 80.0 { 8.6e16 * ((z - 80.0) / 6.0) } else { 0.0 };
            let zm = z + DZ / 2.0; lnp -= mbar * g_at(Body::Earth, zm * 1e3) / (C::R * t_earth(zm)) * DZ * 1e3; }
        else { let zm = z - DZ / 2.0; let tm = t_earth(zm); let dlnt = t.ln() - t_earth(z - DZ).ln(); let g = g_at(Body::Earth, zm * 1e3);
            for j in [0usize, 1, 2, 3, 6] { ni[j] *= (-(AMU[j] * 1e-3 * g / (C::R * tm)) * DZ * 1e3 - dlnt).exp(); }
            if z <= 97.0 { ni[6] = 8.6e16 * (4.4e17f64 / 8.6e16).powf((z - 86.0) / 11.0); } }
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
            ni[4] = nd * vmr_w; ni[5] = 5e18 * (-((h - 22.0) / 8.0).powi(2)).exp();
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
    #[test] fn thermosphere_and_separation() { let c = column(Body::Earth, 300.0, 0.0, 420.0); // US76: rho(300 km) 1.916e-11, O dominant
        assert!(c.rho > 0.5 * 1.916e-11 && c.rho < 2.0 * 1.916e-11, "rho300 {}", c.rho); assert!(c.x[6] > c.x[0] && c.x[6] > 0.5, "O {}", c.x[6]);
        let lo = column(Body::Earth, 50.0, 0.0, 420.0); assert!((lo.x[0] - 0.7808).abs() < 0.002); }
    #[test] fn ozone_water_venus_mercury() { let mut s = 0.0; let mut z = 0.0; while z < 80.0 { s += column(Body::Earth, z, 0.0, 420.0).x[5] * column(Body::Earth, z, 0.0, 420.0).n * 100.0; z += 0.1; }
        let du = s / 2.687e20; assert!(du > 220.0 && du < 340.0, "O3 {du} DU");
        assert!((column(Body::Earth, 0.0, 0.01, 420.0).x[4] - 0.0158).abs() < 0.002);
        let v = column(Body::Venus, 0.0, 0.0, 0.0); assert!((v.rho - 65.0).abs() < 5.0, "Venus rho0 {}", v.rho); let v50 = column(Body::Venus, 50.0, 0.0, 0.0); assert!(v50.p > 0.7e5 && v50.p < 1.4e5, "Venus p50 {}", v50.p);
        assert!(column(Body::Mercury, 0.0, 0.0, 0.0).p < 1e-8); }
}
