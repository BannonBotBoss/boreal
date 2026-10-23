//! Wind update (issue #43): sea-level pressure from the column temperature (hypsometric), then geostrophic balance with the Coriolis term.
use crate::atmosphere_budget::*;
use crate::consts::*;
use crate::grid::*;

pub fn update_wind(g: &mut Grid) {
    let (nlat, nlon) = (g.nlat, g.nlon);
    // sea-level pressure = climatological belt + the hypsometric anomaly of each cell from its zonal mean (heat lows over warm land, highs over cold)
    for i in 0..g.n { let ta = g.p(TAIR)[i] + LAPSE * g.p(ELEV)[i].max(0.0) * g.p(LAND)[i]; g.pm(PSL)[i] = sea_level_pressure(ta); } // reduced to sea level
    for r in 0..nlat { let row = r * nlon; let m: f64 = g.p(PSL)[row..row + nlon].iter().sum::<f64>() / nlon as f64;
        let belt = belt_pressure(g.p(LAT)[row]); for c in 0..nlon { let v = &mut g.pm(PSL)[row + c]; *v = belt + (*v - m); } }
    let dphi = std::f64::consts::PI / nlat as f64;
    let dlam = 2.0 * std::f64::consts::PI / nlon as f64;
    for r in 0..nlat {
        let lat = g.p(LAT)[r * nlon];
        let coslat = (lat * std::f64::consts::PI / 180.0).cos().max(0.02);
        let dx = EARTH_RADIUS * coslat * dlam * 2.0; let dy = EARTH_RADIUS * dphi * 2.0;
        for c in 0..nlon {
            let (e, w) = (r * nlon + (c + 1) % nlon, r * nlon + (c + nlon - 1) % nlon);
            let (nn, ss) = (if r + 1 < nlat { (r + 1) * nlon + c } else { r * nlon + c }, if r > 0 { (r - 1) * nlon + c } else { r * nlon + c });
            let psl = g.p(PSL);
            let dpdx = (psl[e] - psl[w]) / dx;
            // rows run south → north, so row+1 is north
            let dpdy = (psl[nn] - psl[ss]) / if r == 0 || r + 1 == nlat { dy / 2.0 } else { dy };
            let i = r * nlon + c;
            let rho = P0 / (RD * (g.p(TAIR)[i] + 273.15));
            let (u, v) = geostrophic(dpdx, dpdy, rho, lat);
            g.pm(U)[i] = u; g.pm(V)[i] = v;
        }
    }
}
