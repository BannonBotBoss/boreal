//! Moisture update (issue #43): evaporation into the humidity column, upwind advection by the surface wind, large-scale condensation,
//! then the Manabe bucket and degree-day snow. Cells share water through the wind only; latent-heat release is not fed back to temperature.
use crate::consts::*;
use crate::grid::*;
use crate::hydrosphere_budget::*;

pub fn update_moisture(g: &mut Grid, dt: f64) {
    let (nlat, nlon, n) = (g.nlat, g.nlon, g.n);
    // 1. evaporation (mm/day diagnostic → kg/m²/s) raises the column humidity: dq = E dt / (ρ Hq)
    for i in 0..n {
        let ta = g.p(TAIR)[i]; let p = crate::atmosphere_budget::surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let rho = p / (RD * (ta + 273.15));
        let e = g.p(EVAP)[i] / 86400.0;
        g.pm(Q)[i] += e * dt / (rho * VAPOUR_SCALE_HEIGHT);
    }
    // 2. upwind advection, sub-stepped to Courant ≤ 0.5
    let dphi = std::f64::consts::PI / nlat as f64;
    let dlam = 2.0 * std::f64::consts::PI / nlon as f64;
    let mut cmax = 0.0f64;
    for r in 0..nlat { let cl = (g.p(LAT)[r * nlon].to_radians()).cos().max(0.05); let dx = EARTH_RADIUS * cl * dlam; let dy = EARTH_RADIUS * dphi;
        for c in 0..nlon { let i = r * nlon + c; cmax = cmax.max(dt * (g.p(U)[i].abs() / dx + g.p(V)[i].abs() / dy)); } }
    let sub = ((cmax / 0.5).ceil() as usize).clamp(1, 64); let h = dt / sub as f64;
    for _ in 0..sub {
        let old: Vec<f64> = g.p(Q).to_vec();
        for r in 0..nlat {
            let cl = (g.p(LAT)[r * nlon].to_radians()).cos().max(0.05); let dx = EARTH_RADIUS * cl * dlam; let dy = EARTH_RADIUS * dphi;
            for c in 0..nlon {
                let i = r * nlon + c; let (u, v) = (g.p(U)[i], g.p(V)[i]);
                let (e, w) = (r * nlon + (c + 1) % nlon, r * nlon + (c + nlon - 1) % nlon);
                let nn = if r + 1 < nlat { (r + 1) * nlon + c } else { i }; let ss = if r > 0 { (r - 1) * nlon + c } else { i };
                let dqx = if u > 0.0 { old[i] - old[w] } else { old[e] - old[i] }; let dqy = if v > 0.0 { old[i] - old[ss] } else { old[nn] - old[i] };
                g.pm(Q)[i] = (old[i] - h * (u * dqx / dx + v * dqy / dy)).max(0.0);
            }
        }
    }
    // 3. condensation, rain onto the bucket / snow store, melt
    for i in 0..n {
        let ta = g.p(TAIR)[i]; let p = crate::atmosphere_budget::surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let (q, rain) = condense(g.p(Q)[i], ta, p); g.pm(Q)[i] = q;
        let land = g.p(LAND)[i] > 0.5; let evap_mm = g.p(EVAP)[i] / 86400.0 * dt;
        g.pm(PRECIP)[i] = if dt > 0.0 { rain / dt * 86400.0 } else { 0.0 };
        g.pm(PW)[i] = column_water(q, p, ta);
        if land {
            let (mut soil, mut swe) = (g.p(SOIL)[i], g.p(SNOW)[i]);
            let mut liquid = 0.0;
            if ta < 0.0 { swe += rain; } else { liquid += rain; }
            let melt = (melt_rate(ta) * dt).min(swe); swe -= melt; liquid += melt;
            let (s, _runoff) = bucket_step(soil, liquid, evap_mm); soil = s;
            g.pm(SOIL)[i] = soil; g.pm(SNOW)[i] = swe;
        }
    }
}
