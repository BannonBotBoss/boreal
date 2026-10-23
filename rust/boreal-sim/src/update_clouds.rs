//! Cloud update (issue #43): cloud fraction from relative humidity (Sundqvist 1989), optical depth from the liquid-water path (Stephens 1978).
use crate::atmosphere_budget::*;
use crate::consts::*;
use crate::grid::*;
use crate::hydrosphere_budget::*;

pub fn update_clouds(g: &mut Grid) {
    for i in 0..g.n {
        let (ta, q) = (g.p(TAIR)[i], g.p(Q)[i]);
        let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), ta);
        let rh = (q / qsat(ta, p)).clamp(0.0, 1.0);
        let c = cloud_fraction(rh);
        g.pm(RH)[i] = rh; g.pm(CLOUD)[i] = c; g.pm(COT)[i] = cloud_optical_depth(c);
    }
}
