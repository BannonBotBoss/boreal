//! Upslope condensation on the existing grid (T-0085, issue #100). Not a second precipitation scheme.
//! Sawyer (1956) and Smith (1979) give the column condensation when every level rises at the surface
//! upslope velocity. Roe (2005, Ann. Rev. Earth Planet. Sci. 33:645, eq. 6) writes that upper bound as
//! S = ρ q_sat (u · ∇z) exp(−z / H_m) for ascent, and 0 for descent.
//! H_m is the vapour scale height already in `humidity_column` (2 km, inside Roe's 2–4 km).
//! q_sat is replaced by the cell's specific humidity: a dry column cannot rain the saturated bound.
//! When the column is saturated the two agree. Manabe condensation in `precipitation.rs` is unchanged.
use crate::consts::EARTH_RADIUS;
use crate::grid::{Grid, ELEV, LAT, U, V};
use super::humidity_column::VAPOUR_SCALE_HEIGHT;

/// kg/m²/s. `rho` is kg/m³, `q` is kg/kg.
pub fn upslope_rate(g: &Grid, i: usize, q: f64, rho: f64) -> f64 {
    if q <= 0.0 || rho <= 0.0 { return 0.0; }
    let (nlat, nlon) = (g.nlat, g.nlon);
    let r = i / nlon;
    let c = i - r * nlon;
    let dphi = std::f64::consts::PI / nlat as f64;
    let dlam = 2.0 * std::f64::consts::PI / nlon as f64;
    let lat = g.p(LAT)[i].to_radians();
    let dx = EARTH_RADIUS * lat.cos().max(0.02) * dlam * 2.0;
    let dy = EARTH_RADIUS * dphi * 2.0;
    let elev = g.p(ELEV);
    let east = r * nlon + (c + 1) % nlon;
    let west = r * nlon + (c + nlon - 1) % nlon;
    let north = if r + 1 < nlat { (r + 1) * nlon + c } else { i };
    let south = if r > 0 { (r - 1) * nlon + c } else { i };
    let dzdx = (elev[east] - elev[west]) / dx;
    let dzdy = (elev[north] - elev[south]) / if r == 0 || r + 1 == nlat { dy / 2.0 } else { dy };
    let climb = g.p(U)[i] * dzdx + g.p(V)[i] * dzdy;
    if climb <= 0.0 { return 0.0; }
    rho * q * climb * (-elev[i].max(0.0) / VAPOUR_SCALE_HEIGHT).exp()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::grid::*;
    use crate::hydrosphere_budget::{qsat, update_moisture};

    fn ridge() -> Grid {
        let mut g = Grid::new(9, 16);
        let row = 6; // latitude −90 + 6.5·20 = 40°
        for i in 0..g.n {
            g.pm(LAND)[i] = 1.0;
            g.pm(ELEV)[i] = 100.0;
            g.pm(TAIR)[i] = 12.0;
            g.pm(U)[i] = 10.0; // Roe's typical mid-latitude wind, from the west
            g.pm(V)[i] = 0.0;
            g.pm(EVAP)[i] = 0.0;
            let p = 100_000.0;
            g.pm(Q)[i] = 0.5 * qsat(12.0, p); // unsaturated, so Manabe condensation stays 0
        }
        let crest = 8i32;
        let nlon = g.nlon;
        for (dc, h) in [(-3i32, 200.0), (-2, 800.0), (-1, 1600.0), (0, 2200.0), (1, 1600.0), (2, 800.0), (3, 200.0)] {
            let c = (crest + dc) as usize;
            g.pm(ELEV)[row * nlon + c] = h;
        }
        g
    }

    #[test] fn windward_rain_exceeds_leeward_rain() {
        let mut g = ridge();
        let row = 6;
        update_moisture(&mut g, 6.0 * 3600.0);
        let at = |c: usize| g.p(PRECIP)[row * g.nlon + c];
        let windward = at(7); // rising toward the crest at column 8, wind from the west
        let leeward = at(9);
        eprintln!("ridge precip mm/day windward {windward:.3} crest {:.3} leeward {leeward:.3}", at(8));
        assert!(windward > leeward, "windward {windward} leeward {leeward}");
        assert!(windward > 0.0);
        assert!(g.p(PRECIP).iter().all(|v| v.is_finite() && *v >= 0.0));
    }

    #[test] fn reversing_the_wind_reverses_the_wet_side() {
        let mut g = ridge();
        for i in 0..g.n { g.pm(U)[i] = -10.0; }
        update_moisture(&mut g, 6.0 * 3600.0);
        let row = 6;
        let west = g.p(PRECIP)[row * g.nlon + 7];
        let east = g.p(PRECIP)[row * g.nlon + 9];
        assert!(east > west, "easterly wind: east face {east} should be wetter than west face {west}");
    }
}
