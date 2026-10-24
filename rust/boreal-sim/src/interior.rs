//! Radial profile of a planet along any outward vector (Matt: "the distance from its core outwards should be an axis"):
//! r = 0 at the centre, r = R at the surface, beyond it the atmosphere and magnetosphere. Returns layer, density, temperature,
//! pressure and gravity at r.
//! Interior: PREM density polynomials (Dziewonski & Anderson 1981, PEPI 25:297, Table 1, isotropic), mass and hydrostatic
//! pressure integrated from them (dP/dr = -rho g, g = G M(r)/r^2). Geotherm: piecewise linear through cited anchors [approx]:
//! surface 288 K; lithosphere base 100 km 1600 K (Turcotte & Schubert 2014); 410 km 1760 K and 660 km 1900 K (Katsura et al. 2010);
//! top of D'' 2740 km 2500 K; CMB 2891 km 4000 K (Lay et al. 2008, 3500-4400); ICB 5150 km 6000 K (Anzellini et al. 2013, 6230+-500);
//! centre 6300 K. Atmosphere: U.S. Standard Atmosphere 1976 layers to 86 km, then 186.87 K to 91 km, linear to 240 K at 110 km,
//! +12 K/km to 360 K at 120 km, then T = 1000 - 640 exp(-0.01875 (z-120)) (US76 thermosphere); molar mass held at 28.96 g/mol
//! above 86 km [approx]. Magnetosphere (above the exobase ~500 km to the magnetopause): plasmasphere n = 1390 (3/L)^4.83 cm^-3 to
//! the plasmapause L 4.5 then 1 cm^-3 (Carpenter & Anderson 1992, JGR 97:1097), 1 eV inside / 1 keV outside [approx]; solar wind
//! beyond, 5 cm^-3, 1e5 K (OMNI typical).
use crate::consts::*;
use std::sync::OnceLock;

pub const LAYERS: [&str; 8] = ["inner core", "outer core", "mantle", "crust", "ocean", "atmosphere", "magnetosphere", "solar wind"];
const PREM_R: f64 = 6371.0; // km, PREM normalising radius
/// Material density field (g/cm3) and layer index at radius r km: PREM inside, the gas column outside, one continuous field.
pub fn prem_density(r: f64) -> (f64, usize) {
    let x = r / PREM_R;
    if r < 1221.5 { (13.0885 - 8.8381 * x * x, 0) }
    else if r < 3480.0 { (12.5815 - 1.2638 * x - 3.6426 * x * x - 5.5281 * x * x * x, 1) }
    else if r < 5701.0 { (7.9565 - 6.4761 * x + 5.5283 * x * x - 3.0807 * x * x * x, 2) }
    else if r < 5771.0 { (5.3197 - 1.4836 * x, 2) }
    else if r < 5971.0 { (11.2494 - 8.0298 * x, 2) }
    else if r < 6151.0 { (7.1089 - 3.8045 * x, 2) }
    else if r < 6346.6 { (2.6910 + 0.6924 * x, 2) }
    else if r < 6356.0 { (2.900, 3) } else if r < 6368.0 { (2.600, 3) } else if r <= PREM_R { (1.020, 4) }
    else { (crate::gas::column(crate::gas::Body::Earth, r - PREM_R, 0.0, crate::constants::CO2_ppm_present).rho / 1000.0, 5) } // above: gas (gas.rs)
}
struct Tab { m: Vec<f64>, p: Vec<f64> } // per 100 m from the centre: enclosed mass (kg), pressure (Pa)
const STEP_M: f64 = 100.0;
fn tab() -> &'static Tab { static T: OnceLock<Tab> = OnceLock::new(); T.get_or_init(|| {
    let n = (PREM_R * 1000.0 / STEP_M) as usize; let mut m = vec![0.0; n + 1];
    for i in 0..n { let r = (i as f64 + 0.5) * STEP_M; m[i + 1] = m[i] + 4.0 * std::f64::consts::PI * r * r * prem_density(r / 1000.0).0 * 1000.0 * STEP_M; }
    let mut p = vec![0.0; n + 1]; // surface pressure of the solid/ocean = 1 atm
    p[n] = P0; for i in (0..n).rev() { let r = (i as f64 + 0.5) * STEP_M; let g = G_CONST * 0.5 * (m[i] + m[i + 1]) / (r * r);
        p[i] = p[i + 1] + prem_density(r / 1000.0).0 * 1000.0 * g * STEP_M; }
    Tab { m, p } }) }
fn geotherm(depth_km: f64) -> f64 { const A: [(f64, f64); 8] = [(0.0, 288.0), (100.0, 1600.0), (410.0, 1760.0), (660.0, 1900.0), (2740.0, 2500.0), (2891.0, 4000.0), (5150.0, 6000.0), (6371.0, 6300.0)];
    for w in A.windows(2) { if depth_km <= w[1].0 { let f = (depth_km - w[0].0) / (w[1].0 - w[0].0); return w[0].1 + f * (w[1].1 - w[0].1); } } 6300.0 }
const MAIR: f64 = 0.0289644; const RGAS: f64 = 8.31446; const KB: f64 = 1.380649e-23; const MP: f64 = 1.67262e-27;
/// Atmosphere comes from the single gas column (gas.rs).
pub const EXOBASE_KM: f64 = 500.0; // ~500 km (Chamberlain 1963) [approx]
/// Profile at signed radius r (km, |r| used; the sign is the direction along the axis): [layer, rho kg/m3, T K, P Pa, g m/s2].
/// `mp_re` = magnetopause standoff in Earth radii (core/geodynamo.ts shueR0).
pub fn profile(r_km: f64, mp_re: f64) -> [f64; 5] {
    let r = r_km.abs(); let re = EARTH_RADIUS / 1000.0;
    if r <= PREM_R { let t = tab(); let i = ((r * 1000.0 / STEP_M) as usize).min(t.p.len() - 1); let (rho, l) = prem_density(r);
        let g = if r > 0.0 { G_CONST * t.m[i] / (r * 1000.0).powi(2) } else { 0.0 };
        return [l as f64, rho * 1000.0, if l == 4 { 277.0 } else { geotherm(PREM_R - r) }, t.p[i], g]; } // ocean mean 4 C (Levitus) [approx]
    let z = r - re.max(PREM_R); let g = G_CONST * EARTH_MASS / (r * 1000.0).powi(2);
    if z < EXOBASE_KM { let c = crate::gas::column(crate::gas::Body::Earth, z, 0.0, 420.0); return [5.0, c.rho, c.t, c.p, g]; }
    let l_shell = r / re;
    if l_shell < mp_re { let (n, t) = if l_shell < 4.5 { (1390.0 * (3.0 / l_shell).powf(4.83), 11604.5) } else { (1.0, 1.16e7) };
        let n = n * 1e6; return [6.0, n * MP, t, 2.0 * n * KB * t, g]; }
    let n = 5.0e6; [7.0, n * MP, 1.0e5, 2.0 * n * KB * 1.0e5, g]
}
#[cfg(test)]
mod tests { use super::*;
    #[test] fn prem_mass_and_pressures() { let t = tab(); let m = *t.m.last().unwrap();
        assert!((m / 5.972e24 - 1.0).abs() < 0.005, "mass {m:e}");
        let p = |r: f64| profile(r, 10.0)[3] / 1e9; // PREM: centre 363.85, ICB 328.85, CMB 135.75 GPa
        assert!((p(0.0) - 363.85).abs() < 4.0, "centre {}", p(0.0)); assert!((p(1221.0) - 328.85).abs() < 4.0); assert!((p(3479.0) - 135.75).abs() < 2.0, "cmb {}", p(3479.0));
        assert!((profile(6371.0 - 2891.5, 10.0)[4] - 10.68).abs() < 0.1, "g at CMB {}", profile(3480.0, 10.0)[4]); }
    #[test] fn us76_atmosphere() { let re = EARTH_RADIUS / 1000.0;
        let a = |z: f64| profile(re + z, 10.0); assert!((a(0.0)[3] - 101325.0).abs() < 1.0); assert!((a(11.0)[3] / 22700.0 - 1.0).abs() < 0.01, "{}", a(11.0)[3]);
        assert!((a(11.0)[2] - 216.77).abs() < 0.05); assert!((a(0.0)[1] - 1.225).abs() < 0.005); assert!(a(300.0)[2] > 900.0 && a(300.0)[3] < 1e-3); }
    #[test] fn layers_in_order() { let re = EARTH_RADIUS / 1000.0; let l: Vec<f64> = [0.0, 2000.0, 5000.0, 6360.0, 6370.0, re + 10.0, re * 3.0, re * 20.0].iter().map(|&r| profile(r, 10.0)[0]).collect();
        assert_eq!(l, vec![0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0]); }
}

/// Figure of the Earth from its own material field, not a declared sphere (Matthew: "that is how it should be generated").
/// Surface radius = outermost radius where the condensed (solid/liquid, rho > 0.5 g/cc) PREM density meets gas.
pub fn surface_radius_km() -> f64 { let mut r = PREM_R + 50.0; while r > 0.0 && prem_density(r).0 < 0.5 { r -= 0.001; } r + 0.0005 }
/// Polar moment factor C/(M R^2) = (8 pi/3) int rho r^4 dr / (M R^2), integrated from PREM.
pub fn moi_factor() -> f64 { let t = tab(); let m = *t.m.last().unwrap(); let n = t.m.len() - 1; let mut c = 0.0;
    for i in 0..n { let r = (i as f64 + 0.5) * STEP_M; c += 8.0 * std::f64::consts::PI / 3.0 * prem_density(r / 1000.0).0 * 1000.0 * r.powi(4) * STEP_M; }
    let rs = surface_radius_km() * 1000.0; c / (m * rs * rs) }
/// Hydrostatic flattening with spin from Darwin–Radau (Jeffreys 1976 §4.03; Bullen 1975):
/// f = (5m/2) / (1 + (25/4)(1 - 3C/(2Ma^2))^2), m = omega^2 a^3 / GM; a from the volume-equivalent radius, a = R (1-f)^(-1/3).
/// Returns (f, a_km, c_km). GM, omega from the constants graph.
pub fn figure() -> (f64, f64, f64) { let rs = surface_radius_km() * 1000.0; let k = moi_factor(); let mut f: f64 = 0.0;
    for _ in 0..20 { let a = rs * (1.0 - f).powf(-1.0 / 3.0); let m = crate::constants::omega_earth.powi(2) * a.powi(3) / crate::constants::GM_earth;
        let ka = k * (rs / a).powi(2); f = 2.5 * m / (1.0 + 6.25 * (1.0 - 1.5 * ka).powi(2)); }
    let a = rs * (1.0 - f).powf(-1.0 / 3.0); (f, a / 1000.0, a * (1.0 - f) / 1000.0) }
#[cfg(test)]
mod figure_tests { use super::*;
    #[test] fn emergent_figure() { let r = surface_radius_km(); assert!((r - 6371.0).abs() < 0.01, "surface {r}");
        let k = moi_factor(); assert!((k - 0.3308).abs() < 0.002, "C/MR^2 {k}"); // PREM 0.3308 (Dziewonski & Anderson 1981)
        let (f, a, c) = figure(); assert!((1.0 / f - 298.257).abs() / 298.257 < 0.01, "1/f {}", 1.0 / f); // WGS84 1/298.257223563
        assert!((a - 6378.137).abs() < 1.0 && (c - 6356.752).abs() < 1.0, "a {a} c {c}"); }
}
