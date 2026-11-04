//! One scratch planet, used when the panel asks what the climate engines would say.
//! It does not touch the live grid the game is drawing.

use crate::boot_order;
use crate::grid::{self, Grid};
use crate::registry;
use std::collections::BTreeMap;

#[derive(Clone, Copy)]
pub struct Stat {
    pub min: f64,
    pub mean: f64,
    pub max: f64,
    pub n: u32,
}

#[derive(Clone)]
pub struct Snap {
    pub nlat: usize,
    pub nlon: usize,
    pub stats: BTreeMap<&'static str, Stat>,
}

impl Snap {
    pub fn mean(&self, plane: &str) -> f64 {
        self.stats.get(plane).map(|s| s.mean).unwrap_or(f64::NAN)
    }
    pub fn stat(&self, plane: &str) -> Option<Stat> {
        self.stats.get(plane).copied()
    }
}

fn summarize(g: &Grid, k: usize) -> Stat {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut acc = 0.0;
    let mut wsum = 0.0;
    let mut n = 0u32;
    for i in 0..g.n {
        let v = g.p(k)[i];
        if !v.is_finite() || v < -900.0 {
            continue;
        }
        let w = g.p(grid::LAT)[i].to_radians().cos().max(0.0);
        min = min.min(v);
        max = max.max(v);
        acc += v * w;
        wsum += w;
        n += 1;
    }
    Stat { min: if n == 0 { f64::NAN } else { min }, max: if n == 0 { f64::NAN } else { max }, mean: if wsum > 0.0 { acc / wsum } else { f64::NAN }, n }
}

pub fn run(day: f64, hour: f64, nlat: usize, nlon: usize) -> Snap {
    let _quiet = registry::suppress();
    let mut g = Grid::new(nlat, nlon);
    for i in 0..g.n {
        let (lat, lon) = (g.p(grid::LAT)[i], g.p(grid::LON)[i]);
        let land = ((lon + 180.0) % 120.0 < 60.0 && lat.abs() < 70.0) || lat < -70.0;
        g.pm(grid::LAND)[i] = if land { 1.0 } else { 0.0 };
        g.pm(grid::ELEV)[i] = if land { 300.0 } else { 0.0 };
    }
    boot_order::boot(&mut g, day, hour);
    g.step(6.0 * 3600.0);
    let mut stats = BTreeMap::new();
    for (name, idx) in [("ts", grid::TS), ("tair", grid::TAIR), ("q", grid::Q), ("toa", grid::TOA), ("swdown", grid::SWDOWN), ("qabs", grid::QABS), ("evap", grid::EVAP), ("olr", grid::OLR), ("u", grid::U), ("v", grid::V), ("pressure", grid::PRESSURE), ("precip", grid::PRECIP), ("snow", grid::SNOW), ("soil", grid::SOIL), ("cloud", grid::CLOUD), ("cot", grid::COT)] {
        stats.insert(name, summarize(&g, idx));
    }
    Snap { nlat, nlon, stats }
}
