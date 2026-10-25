//! Cloud fraction split from `atmosphere_budget.rs` and `update_clouds.rs` (T-0062, issue #46). Sundqvist 1989.
use crate::consts::*;
use crate::grid::*;
use crate::planet_fundamentals::hydrosphere::humidity_column::qsat;
use super::cloud_optical_depth::cloud_optical_depth;
use super::pressure::surface_pressure;

/// Cloud fraction from relative humidity (Sundqvist, Berge & Kristjánsson 1989, Mon. Weather Rev. 117:1641): C = 1 − sqrt((1−RH)/(1−RHc)) for RH > RHc.
pub const RH_CRIT: f64 = 0.75; // critical RH, typical 0.7–0.9 [verify]
pub fn cloud_fraction(rh: f64) -> f64 { if rh <= RH_CRIT { 0.0 } else { (1.0 - ((1.0 - rh.min(1.0)) / (1.0 - RH_CRIT)).sqrt()).clamp(0.0, 1.0) } }

/// Saturated equivalent-potential-temperature proxy (K) at pressure p: (T + Lv qsat / cp)(P0/p)^(Rd/cp) (Bolton 1980 simplified).
fn theta_es(t_c: f64, p: f64) -> f64 { (t_c + 273.15 + LV * qsat(t_c, p) / CP) * (P0 / p).powf(RD / CP) }
/// 700 hPa temperature (°C) on the moist adiabat of a surface parcel (moist static energy conserved; bisection).
pub fn t700_moist(ts_c: f64, q: f64) -> f64 { let te = (ts_c + 273.15 + LV * q / CP) * (P0 / P0).powf(RD / CP);
    let (mut a, mut b) = (-80.0, 40.0); for _ in 0..40 { let m = 0.5 * (a + b); if theta_es(m, 7.0e4) > te { b = m } else { a = m } } 0.5 * (a + b) }
/// Lower-tropospheric stability θ700 − θs (K) (Klein & Hartmann 1993).
pub fn lts(t700_c: f64, ts_c: f64) -> f64 { (t700_c + 273.15) * (P0 / 7.0e4).powf(RD / CP) - (ts_c + 273.15) }
/// Marine low (stratocumulus) cloud from LTS: 5.7 %/K · LTS − 55.7 % (Klein & Hartmann 1993, J. Climate 6:1587, seasonal-mean fit).
pub fn low_cloud_lts(lts_k: f64) -> f64 { (0.057 * lts_k - 0.557).clamp(0.0, 1.0) }
/// Convective cloud from the precipitation rate: 0.245 + 0.125 ln P (P mm/day), ≤ 0.8 (Slingo 1987, QJRMS 113:899 [verify]).
/// Duration of synoptic ascent ahead of a warm front, ~half a baroclinic wave period (2-4 d; Holton 2004) [approx]: 1 day.
/// Cloud-field memory: the diagnosed cover is the cloud that forms; existing cloud decays over its lifetime rather than
/// vanishing in one step. Cloud-system lifetimes are hours to ~1 day (Houze 2004; ISCCP tracking, Machado & Rossow 1993) [approx]: 6 h.
pub const CLOUD_TAU_S: f64 = 21600.0;
/// Share of a baroclinic wave that is ascending: w is sinusoidal in a linear Eady wave, so half the area rises (Holton 2004 §8.4).
pub const ASCENT_SHARE: f64 = 0.5;
pub const SYNOPTIC_LIFT_S: f64 = 86400.0;
pub fn conv_cloud(p_mm_day: f64) -> f64 { if p_mm_day < 0.14 { 0.0 } else { (0.245 + 0.125 * p_mm_day.ln()).clamp(0.0, 0.8) } }

/// Total cover from three causes, randomly overlapped (Slingo 1987 scheme structure): boundary-layer RH (Sundqvist 1989),
/// convection (precipitation), and inversion-capped marine stratocumulus (LTS). The free-troposphere 700 hPa temperature is
/// horizontally uniform in the tropics (weak temperature gradient, Sobel & Bretherton 2000): the moist adiabat of the band's
/// warmest-decile ocean air sets it within ±25°; poleward it follows each latitude row's zonal-mean moist adiabat.
pub fn update_clouds(g: &mut Grid, dt: f64) {
    let keep = if dt > 0.0 { (-dt / CLOUD_TAU_S).exp() } else { 0.0 };
    let (nlat, nlon) = (g.nlat, g.nlon);
    let mut t7row = vec![0.0; nlat]; let mut trop: Vec<f64> = Vec::new();
    for r in 0..nlat { let mut s = 0.0; for c in 0..nlon { let i = r * nlon + c; let t = t700_moist(g.p(TAIR)[i], g.p(Q)[i]); s += t;
            if g.p(LAT)[i].abs() < 25.0 && g.p(LAND)[i] < 0.5 { trop.push(t); } } t7row[r] = s / nlon as f64; }
    trop.sort_by(|a, b| a.partial_cmp(b).unwrap()); let t7trop = if trop.is_empty() { None } else { Some(trop[(trop.len() * 9) / 10]) };
    // Synoptic ascent from warm advection (isentropic upglide): in steady state the advective warming A = −V·∇T is balanced by
    // adiabatic cooling of ascent, w = A / (Γd − Γ) (Holton 2004, §6.4; Γd 9.8, Γ 6.5 K/km). Air lifted for SYNOPTIC_LIFT_S rises
    // dz = w τ and its RH grows by exp(dz (Lv Γd/(Rv T²) − g/(Rd T))) (Clausius-Clapeyron along the dry adiabat, minus the pressure fall).
    let (dphi, dlam) = (std::f64::consts::PI / nlat as f64, 2.0 * std::f64::consts::PI / nlon as f64);
    let mut lift = vec![1.0f64; g.n];
    for r in 0..nlat { let cl = g.p(LAT)[r * nlon].to_radians().cos().max(0.05); let (dx, dy) = (2.0 * EARTH_RADIUS * cl * dlam, EARTH_RADIUS * dphi);
        for c in 0..nlon { let i = r * nlon + c; let t = g.p(TAIR);
            let (e, w) = (r * nlon + (c + 1) % nlon, r * nlon + (c + nlon - 1) % nlon);
            let (nn, ss, dyy) = if r == 0 { ((r + 1) * nlon + c, i, dy) } else if r + 1 == nlat { (i, (r - 1) * nlon + c, dy) } else { ((r + 1) * nlon + c, (r - 1) * nlon + c, 2.0 * dy) };
            let a = -(g.p(U)[i] * (t[e] - t[w]) / dx + g.p(V)[i] * (t[nn] - t[ss]) / dyy);
            if a > 0.0 { let tk = t[i] + 273.15; let wz = a / (0.0098 - LAPSE); let dz = (wz * SYNOPTIC_LIFT_S).min(3000.0);
                lift[i] = (dz * (LV * 0.0098 / (RV * tk * tk) - gravity() / (RD * tk))).exp(); } } }
    // Free-troposphere (700 hPa) cloud by isentropic upglide: in baroclinic zones boundary-layer air from lower latitudes slides up
    // its isentrope (warm conveyor belts, Harrold 1973; Browning 1990) and arrives at 700 hPa over row r if its surface theta matches
    // theta_700(r). It keeps its specific humidity, so RH_700 = q_src / qsat(T700, 700 hPa); cloud from Sundqvist on RH_700.
    // T700 = zonal-mean surface air - Gamma x 3 km (ICAO lapse; 700 hPa ~ 3 km, Wallace & Hobbs 2006). Searches the same hemisphere equatorward.
    let zm = |k: usize, r: usize| g.p(k)[r * nlon..(r + 1) * nlon].iter().sum::<f64>() / nlon as f64;
    let ft: Vec<f64> = (0..nlat).map(|r| { let t7 = zm(TAIR, r) - LAPSE * 3000.0; let th7 = (t7 + 273.15) * (P0 / 7.0e4).powf(RD / CP);
        let lat = g.p(LAT)[r * nlon]; let mut best = None;
        let rows: Vec<usize> = if lat >= 0.0 { (0..r).rev().filter(|&s| g.p(LAT)[s * nlon] >= 0.0).collect() } else { (r + 1..nlat).filter(|&s| g.p(LAT)[s * nlon] < 0.0).collect() };
        for s in rows { if zm(TAIR, s) + 273.15 >= th7 { best = Some(s); break; } }
        best.map_or(0.0, |s| ASCENT_SHARE * cloud_fraction((zm(Q, s) / qsat(t7, 7.0e4)).min(1.0))) }).collect();
    for i in 0..g.n {
        let (ta, q) = (g.p(TAIR)[i], g.p(Q)[i]);
        let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let rh = (q / qsat(ta, p)).clamp(0.0, 1.0);
        let lat = g.p(LAT)[i]; let t7 = match t7trop { Some(t) if lat.abs() < 25.0 => t, _ => t7row[i / nlon] };
        let cst = if g.p(LAND)[i] < 0.5 { low_cloud_lts(lts(t7, ta)) } else { 0.0 };
        let cfront = cloud_fraction((rh * lift[i]).min(1.0)) - cloud_fraction(rh); // the extra cloud the ascent makes
        let c = 1.0 - (1.0 - cloud_fraction(rh)) * (1.0 - cfront.max(0.0)) * (1.0 - ft[i / nlon]) * (1.0 - conv_cloud(g.p(PMEAN)[i])) * (1.0 - cst);
        let c = keep * g.p(CLOUD)[i] + (1.0 - keep) * c; g.pm(RH)[i] = rh; g.pm(CLOUD)[i] = c; g.pm(COT)[i] = cloud_optical_depth(c);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// Synthetic Earth-like planet: three 60°-wide continents to ±70°, Antarctica; 30 days from the July seed (day 196).
    fn spun(day: f64) -> Grid { let mut g = Grid::new(45, 90);
        for i in 0..g.n { let (lat, lon) = (g.p(LAT)[i], g.p(LON)[i]); let land = ((lon + 180.0) % 120.0 < 40.0 && lat.abs() < 70.0) || lat < -70.0;
            g.pm(LAND)[i] = if land { 1.0 } else { 0.0 }; g.pm(ELEV)[i] = if land { 400.0 } else { 0.0 }; }
        g.seed(day, 0.0); for _ in 0..10 * 8 { g.step(3.0 * 3600.0); } g }
    #[test] fn cloud_field_has_memory() { let mut g = spun(196.0); let a = g.p(CLOUD).to_vec(); g.step(3.0 * 3600.0);
        let d = a.iter().zip(g.p(CLOUD)).map(|(x, y)| (x - y).abs()).sum::<f64>() / a.len() as f64; eprintln!("mean |dC| per 3 h step {d:.4}"); assert!(d < 0.015, "instantaneous diagnosis gave 0.0226"); }
    fn band(g: &Grid, a: f64, b: f64) -> f64 { let (mut s, mut w) = (0.0, 0.0); for i in 0..g.n { let l = g.p(LAT)[i]; if l >= a && l < b { let c = l.to_radians().cos(); s += g.p(CLOUD)[i] * c; w += c; } } s / w }
    #[test] fn cloud_cover_vs_modis() {
        // MODIS (King et al. 2013, IEEE TGRS 51:3826) annual global cloud fraction 0.67; zonal means ~0.8 in the Southern Ocean storm
        // track (50-65 S), ~0.5-0.6 in the subtropics, ~0.7 in the NH storm track.
        for day in [15.0, 196.0] { let g = spun(day);
            let (gl, so, st, nh, tr) = (band(&g, -90.0, 90.0), band(&g, -65.0, -50.0), band(&g, -30.0, -15.0), band(&g, 45.0, 65.0), band(&g, -10.0, 10.0));
            { let mut h=[0.0;4]; let mut ps=vec![]; for i in 0..g.n { let w=g.p(LAT)[i].to_radians().cos(); h[0]+=w*cloud_fraction(g.p(RH)[i]); h[1]+=w*conv_cloud(g.p(PMEAN)[i]); h[3]+=w; ps.push(g.p(PMEAN)[i]); }
              ps.sort_by(|a,b|a.partial_cmp(b).unwrap()); eprintln!("rh-part {:.2} conv-part {:.2} precip p50 {:.2} p90 {:.2} mean {:.2}", h[0]/h[3], h[1]/h[3], ps[ps.len()/2], ps[ps.len()*9/10], ps.iter().sum::<f64>()/ps.len() as f64); }
            eprintln!("day {day}: global {gl:.2}  SO {so:.2}  S-subtrop {st:.2}  NH 45-65 {nh:.2}  tropics {tr:.2}");
            assert!((gl - 0.67).abs() < 0.08, "global cloud {gl:.2} vs MODIS 0.67"); assert!(so > 0.55 && nh > 0.55, "storm tracks SO {so:.2} NH {nh:.2} vs MODIS ~0.7-0.8"); }
    }
    #[test] fn clouds_from_humidity() { assert_eq!(cloud_fraction(0.5), 0.0); assert!((cloud_fraction(1.0) - 1.0).abs() < 1e-12); assert!(cloud_fraction(0.9) > 0.0 && cloud_fraction(0.9) < 1.0); }
}
