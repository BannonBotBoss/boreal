//! Condensation and rain split from `hydrosphere_budget.rs` and `update_moisture.rs` (T-0062, issue #46).
//! Large-scale condensation is Manabe 1965. Degree-day melt is Hock 2003. The near field remains Kessler 1969 in weather.ts.
use crate::consts::*;
use crate::grid::*;
use super::humidity_column::{column_water, qsat, BL_RH, BL_VENT_S, VAPOUR_SCALE_HEIGHT};
use super::orographic::upslope_rate;
use super::soil_moisture::bucket_step;
use crate::planet_fundamentals::atmosphere::pressure::surface_pressure;

/// Degree-day snow melt (Hock 2003): mm w.e. per second when air is above 0 °C.
pub fn melt_rate(t_c: f64) -> f64 { DDF * t_c.max(0.0) / 86400.0 }

/// Where new water goes, and the melt already in `melt_rate`.
/// Below 0 °C it joins the snow store. At and above 0 °C it is rain (issue #100).
/// Returns (snow water mm, liquid mm for the bucket).
pub fn settle_precip(t_c: f64, rain_mm: f64, swe_mm: f64, dt: f64) -> (f64, f64) {
    let mut swe = swe_mm;
    let mut liquid = 0.0;
    if t_c < 0.0 { swe += rain_mm; } else { liquid += rain_mm; }
    let melt = (melt_rate(t_c) * dt).min(swe.max(0.0));
    swe -= melt;
    liquid += melt;
    (swe, liquid)
}

/// Large-scale condensation (Manabe 1965): vapour above saturation falls out as rain. Returns (new q, precipitation kg/m²).
pub fn condense(q: f64, t_c: f64, p: f64) -> (f64, f64) {
    let qs = qsat(t_c, p);
    if q <= qs { return (q, 0.0); }
    (qs, (q - qs) * p / (RD * (t_c + 273.15)) * VAPOUR_SCALE_HEIGHT)
}

/// Precipitating-convection memory for the cloud it leaves (anvils, stratiform shields): mesoscale convective systems live
/// 6-12 h and their anvils outlast the rain (Houze 2004, Rev. Geophys. 42:RG4003); e-folding 12 h.
pub const PRECIP_TAU_S: f64 = 43200.0;

/// Moisture update: evaporation into the humidity column, upwind advection, large-scale condensation, then the bucket and snow.
pub fn update_moisture(g: &mut Grid, dt: f64) {
    let (nlat, nlon, n) = (g.nlat, g.nlon, g.n);
    // 1. evaporation (mm/day diagnostic → kg/m²/s) raises the column humidity: dq = E dt / (ρ Hq)
    for i in 0..n {
        let ta = g.p(TAIR)[i]; let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let rho = p / (RD * (ta + 273.15));
        let e = g.p(EVAP)[i] / 86400.0;
        g.pm(Q)[i] += e * dt / (rho * VAPOUR_SCALE_HEIGHT);
    }
    let mut vent = vec![0.0f64; n];
    // 1b. boundary-layer ventilation: entrainment of drier free-tropospheric air and shallow convection export vapour, relaxing q
    //     toward the observed mean boundary-layer RH (Manabe & Wetherald 1967 fixed-RH profile, 0.77 at the surface) on the
    //     ventilation time scale BL_VENT_S (3 d; Betts & Ridgway 1989, J. Atmos. Sci. 46:2621 [verify]). Only dries; evaporation can still
    //     hold a cell above it (steady rh = 0.77 + E tau / (rho H qsat)).
    for i in 0..n {
        let ta = g.p(TAIR)[i]; let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let qe = BL_RH * qsat(ta, p); let q = g.p(Q)[i];
        if q > qe { let qn = qe + (q - qe) * (-dt / BL_VENT_S).exp(); g.pm(Q)[i] = qn;
            let rho = p / (RD * (ta + 273.15)); vent[i] = (q - qn) * rho * VAPOUR_SCALE_HEIGHT; } // kg/m² = mm lifted out of the BL
    }
    // The exported vapour condenses aloft and rains out in the same column (deep column-local condensation; in steady state
    // global precipitation = evaporation, Trenberth et al. 2007 ~2.7 mm/day). It is added to the large-scale rain in step 3.
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
        let ta = g.p(TAIR)[i]; let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let rho = p / (RD * (ta + 273.15));
        let q_now = g.p(Q)[i];
        let dump = {
            let rate = upslope_rate(g, i, q_now, rho);
            (rate * dt).max(0.0).min(column_water(q_now, p, ta).max(0.0))
        };
        if dump > 0.0 { g.pm(Q)[i] = (q_now - dump / (rho * VAPOUR_SCALE_HEIGHT).max(1.0)).max(0.0); }
        let (q, rain0) = condense(g.p(Q)[i], ta, p); g.pm(Q)[i] = q; let rain = rain0 + vent[i] + dump;
        let land = g.p(LAND)[i] > 0.5; let evap_mm = g.p(EVAP)[i] / 86400.0 * dt;
        g.pm(PRECIP)[i] = if dt > 0.0 { rain / dt * 86400.0 } else { 0.0 };
        if dt > 0.0 { let k = 1.0 - (-dt / PRECIP_TAU_S).exp(); let pr = g.p(PRECIP)[i]; g.pm(PMEAN)[i] += (pr - g.p(PMEAN)[i]) * k; }
        g.pm(PW)[i] = column_water(q, p, ta);
        if land {
            let (soil, swe0) = (g.p(SOIL)[i], g.p(SNOW)[i]);
            let (swe, liquid) = settle_precip(ta, rain, swe0, dt);
            let (s, _runoff) = bucket_step(soil, liquid, evap_mm);
            g.pm(SOIL)[i] = s; g.pm(SNOW)[i] = swe;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::{Grid, ELEV, EVAP, LAND, Q, SNOW, SOIL, TAIR, U, V};
    #[test] fn condense_conserves_water() { let (q, p) = condense(0.03, 20.0, 100000.0); assert!(q < 0.03 && p > 0.0); assert_eq!(condense(0.001, 20.0, 100000.0).1, 0.0); }
    #[test]
    fn below_zero_is_snow_and_zero_is_rain_and_melt_keeps_ddf() {
        let (swe, liquid) = settle_precip(-4.0, 10.0, 0.0, 86400.0);
        assert!((swe - 10.0).abs() < 1e-9 && liquid.abs() < 1e-9);
        let (swe, liquid) = settle_precip(0.0, 10.0, 3.0, 86400.0);
        assert!((swe - 3.0).abs() < 1e-9 && (liquid - 10.0).abs() < 1e-9, "at 0 °C the new water is rain and the store does not melt");
        let melt = DDF * 2.0;
        let (swe, liquid) = settle_precip(2.0, 1.0, 20.0, 86400.0);
        assert!((swe - (20.0 - melt)).abs() < 1e-6 && (liquid - (1.0 + melt)).abs() < 1e-6);
        assert!((melt_rate(1.0) * 86400.0 - DDF).abs() < 1e-9);
        assert!((DDF - 3.0).abs() < 1e-12, "the degree-day factor already in consts");
    }
    fn flat(t: f64, snow: f64) -> Grid {
        let mut g = Grid::new(2, 2);
        for i in 0..g.n {
            g.pm(LAND)[i] = 1.0;
            g.pm(ELEV)[i] = 100.0;
            g.pm(TAIR)[i] = t;
            g.pm(Q)[i] = 0.02; // above saturation from −5 °C through +5 °C, so the column rains
            g.pm(SOIL)[i] = 40.0;
            g.pm(SNOW)[i] = snow;
            g.pm(EVAP)[i] = 0.0;
            g.pm(U)[i] = 0.0;
            g.pm(V)[i] = 0.0;
        }
        g
    }
    #[test]
    fn update_moisture_snow_below_zero_rain_at_and_above() {
        let mut cold = flat(-5.0, 0.0);
        update_moisture(&mut cold, 3600.0);
        assert!(cold.p(SNOW)[0] > 0.0, "snow {}", cold.p(SNOW)[0]);
        assert!((cold.p(SOIL)[0] - 40.0).abs() < 1e-4, "soil {}", cold.p(SOIL)[0]);
        let mut freezing = flat(0.0, 0.0);
        update_moisture(&mut freezing, 3600.0);
        assert!(freezing.p(SNOW)[0].abs() < 1e-6, "snow {}", freezing.p(SNOW)[0]);
        assert!(freezing.p(SOIL)[0] > 40.0, "soil {}", freezing.p(SOIL)[0]);
        let mut warm = flat(5.0, 0.0);
        update_moisture(&mut warm, 3600.0);
        assert!(warm.p(SNOW)[0].abs() < 1e-6, "snow {}", warm.p(SNOW)[0]);
        assert!(warm.p(SOIL)[0] > 40.0, "soil {}", warm.p(SOIL)[0]);
        let mut melting = flat(5.0, 30.0);
        update_moisture(&mut melting, 86400.0);
        let expect = (30.0 - DDF * 5.0).max(0.0);
        assert!((melting.p(SNOW)[0] - expect).abs() < 1e-3, "melted snow {} expected {expect}", melting.p(SNOW)[0]);
    }
}
