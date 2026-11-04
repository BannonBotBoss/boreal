//! The planet grid: a latitude–longitude lattice of cells, each plane one contiguous f64 array (structure of arrays) so
//! JavaScript reads a layer straight out of wasm memory with a `Float64Array` view, no copy.
//! Row r is latitude −90 + (r + 0.5)·180/nlat (south to north), column c is longitude −180 + (c + 0.5)·360/nlon.
use crate::climate_seed::*;

pub const LAT: usize = 0; pub const LON: usize = 1; pub const LAND: usize = 2; pub const ELEV: usize = 3; // inputs (TypeScript fills LAND, ELEV from planet.ts)
pub const TS: usize = 4; pub const TAIR: usize = 5; pub const SOIL: usize = 6; pub const SNOW: usize = 7; pub const Q: usize = 8; // state
pub const CLOUD: usize = 9; pub const ICE: usize = 10;
pub const QABS: usize = 11; pub const QREFL: usize = 12; pub const LWOUT: usize = 13; pub const LWNET: usize = 14; pub const SWDOWN: usize = 15; pub const TOA: usize = 16;
pub const EVAP: usize = 17; pub const PRECIP: usize = 18; pub const PW: usize = 19; pub const PRESSURE: usize = 20; pub const PSL: usize = 21;
pub const U: usize = 22; pub const V: usize = 23; pub const COT: usize = 24; pub const INSTAB: usize = 25; pub const ALBEDO: usize = 26;
pub const SST: usize = 27; pub const RH: usize = 28; pub const HEATCAP: usize = 29; pub const ROUGH: usize = 30; pub const SNOWFRAC: usize = 31; pub const SEAFRAC: usize = 32;
pub const REFLSW: usize = 33; pub const ABSATM: usize = 34; pub const OLR: usize = 35; // column_budget.rs: reflected to space, absorbed by the air, OLR
pub const PMEAN: usize = 36; // precipitation running mean, mm/day (update_moisture.rs, PRECIP_TAU_S)
pub const PLANES: usize = 37;
/// Plane names in index order (exported so TypeScript can check its copy of the table).
pub const NAMES: [&str; PLANES] = ["lat", "lon", "land", "elev", "ts", "tair", "soil", "snow", "q", "cloud", "ice", "qabs", "qrefl", "lwout", "lwnet", "swdown", "toa",
    "evap", "precip", "pw", "pressure", "psl", "u", "v", "cot", "instab", "albedo", "sst", "rh", "heatcap", "rough", "snowfrac", "seafrac", "reflsw", "absatm", "olr", "pmean"];

pub struct Grid { pub nlat: usize, pub nlon: usize, pub n: usize, pub day: f64, pub hour: f64, pub data: Vec<f64>,
    /// Climatological sea-level air temperature per row for land and ocean columns at the current day (climate_seed::damped_seed).
    pub row_land: Vec<f64>, pub row_sea: Vec<f64>, pub(crate) row_day: f64, pub t_bar: f64,
    /// Metres to the nearest ocean cell (`LAND` < 0.5). The host writes inland lakes as land, so a lake is not a source.
    /// Ocean cells are 0. Rebuilt when the mask changes.
    pub coast_m: Vec<f64>, pub(crate) coast_stamp: u64 }
impl Grid {
    pub fn new(nlat: usize, nlon: usize) -> Grid {
        let n = nlat * nlon; let mut g = Grid { nlat, nlon, n, day: 80.0, hour: 12.0, data: vec![0.0; n * PLANES], row_land: vec![0.0; nlat], row_sea: vec![0.0; nlat], row_day: -1.0, t_bar: annual_global_t(), coast_m: Vec::new(), coast_stamp: 0 };
        for r in 0..nlat { for c in 0..nlon { let i = r * nlon + c;
            g.data[LAT * n + i] = -90.0 + (r as f64 + 0.5) * 180.0 / nlat as f64; g.data[LON * n + i] = -180.0 + (c as f64 + 0.5) * 360.0 / nlon as f64; } }
        g
    }
    #[inline] pub fn p(&self, k: usize) -> &[f64] { &self.data[k * self.n..(k + 1) * self.n] }
    #[inline] pub fn pm(&mut self, k: usize) -> &mut [f64] { let n = self.n; &mut self.data[k * n..(k + 1) * n] }
    /// Shortest path, in metres, from each cell to an ocean cell (`LAND` < 0.5). Ocean is 0.
    /// Inland lakes are land in the host mask, so they are not sources.
    /// Recomputed only when the land/sea mask changes, so a step does not repeat the search.
    pub fn refresh_coast(&mut self) {
        let stamp = land_stamp(self);
        if self.coast_m.len() == self.n && self.coast_stamp == stamp { return; }
        self.coast_stamp = stamp;
        self.coast_m = coast_distances(self);
    }
    /// Coast distance (m) of the cell containing (lat, lon); rows south to north, columns west to east from -180.
    pub fn coast_at(&mut self, lat: f64, lon: f64) -> f64 {
        if !(lat.is_finite() && lon.is_finite()) || self.n == 0 { return f64::NAN; }
        self.refresh_coast();
        let r = (((lat + 90.0) / 180.0 * self.nlat as f64).floor() as isize).clamp(0, self.nlat as isize - 1) as usize;
        let c = ((((lon + 180.0) / 360.0).rem_euclid(1.0) * self.nlon as f64).floor() as usize).min(self.nlon - 1);
        self.coast_m[r * self.nlon + c]
    }
    /// Recompute the per-row climatological air temperature when the day has moved on by a quarter day or more.
    pub fn refresh_rows(&mut self) {
        if (self.day - self.row_day).abs() < 0.25 { return; }
        self.row_day = self.day;
        for r in 0..self.nlat { let lat = self.data[LAT * self.n + r * self.nlon];
            self.row_land[r] = damped_seed(self.day, lat, crate::surface_budget::LAND_HEATCAP, self.t_bar);
            self.row_sea[r] = damped_seed(self.day, lat, crate::surface_budget::OCEAN_HEATCAP, self.t_bar); }
    }
    /// Climate seed: fills the state planes from LAND and ELEV (which the caller has set) for `day`.
    /// The body is `planet_initialization::initialize` (T-0062). The call order is the one this method had.
    pub fn seed(&mut self, day: f64, hour: f64) {
        crate::planet_fundamentals::planet_initialization::initialize(self, day, hour);
    }
    /// Advance `dt` seconds: energy, wind, moisture, clouds, in that order (each reads the previous step's other fields).
    /// The body is `planet_update::advance` (T-0062).
    pub fn step(&mut self, dt: f64) {
        crate::planet_fundamentals::planet_update::advance(self, dt);
    }
}

fn land_stamp(g: &Grid) -> u64 {
    let mut h = 0xcbf29ce484222325u64;
    for &v in g.p(LAND) {
        h ^= if v >= 0.5 { 1u64 } else { 0 };
        h = h.wrapping_mul(0x100000001b3);
    }
    h ^ (g.nlat as u64) ^ (g.nlon as u64).rotate_left(17)
}

fn metres_between(g: &Grid, i: usize, j: usize) -> f64 {
    let (la1, lo1) = (g.p(LAT)[i].to_radians(), g.p(LON)[i].to_radians());
    let (la2, lo2) = (g.p(LAT)[j].to_radians(), g.p(LON)[j].to_radians());
    let dlat = la2 - la1;
    let dlon = lo2 - lo1;
    let h = (dlat * 0.5).sin().powi(2) + la1.cos() * la2.cos() * (dlon * 0.5).sin().powi(2);
    2.0 * crate::consts::EARTH_RADIUS * h.clamp(0.0, 1.0).sqrt().asin()
}

/// 4-connected Dijkstra. A binary heap of stale longer paths is skipped when a shorter one is already stored.
fn coast_distances(g: &Grid) -> Vec<f64> {
    let n = g.n;
    let mut dist = vec![f64::INFINITY; n];
    let mut heap: std::collections::BinaryHeap<CoastNode> = std::collections::BinaryHeap::new();
    for i in 0..n {
        if g.p(LAND)[i] < 0.5 { dist[i] = 0.0; heap.push(CoastNode { dist: 0.0, i }); }
    }
    let (nlat, nlon) = (g.nlat, g.nlon);
    while let Some(CoastNode { dist: d, i }) = heap.pop() {
        if d > dist[i] + 1e-3 { continue; }
        let r = i / nlon;
        let c = i - r * nlon;
        let mut neigh = [r * nlon + (c + 1) % nlon, r * nlon + (c + nlon - 1) % nlon, i, i];
        if r + 1 < nlat { neigh[2] = (r + 1) * nlon + c; }
        if r > 0 { neigh[3] = (r - 1) * nlon + c; }
        for &j in &neigh {
            if j == i { continue; }
            let nd = d + metres_between(g, i, j);
            if nd + 1e-3 < dist[j] { dist[j] = nd; heap.push(CoastNode { dist: nd, i: j }); }
        }
    }
    dist
}

#[derive(Copy, Clone)]
struct CoastNode { dist: f64, i: usize }
impl PartialEq for CoastNode { fn eq(&self, o: &Self) -> bool { self.i == o.i && self.dist.to_bits() == o.dist.to_bits() } }
impl Eq for CoastNode {}
impl PartialOrd for CoastNode { fn partial_cmp(&self, o: &Self) -> Option<std::cmp::Ordering> { Some(self.cmp(o)) } }
impl Ord for CoastNode {
    fn cmp(&self, o: &Self) -> std::cmp::Ordering { o.dist.total_cmp(&self.dist).then(self.i.cmp(&o.i)) }
}

#[cfg(test)]
mod tests {
    use super::*;
    /// A synthetic planet (continents: a latitude band of land 30° wide every 120° of longitude; real land comes from planet.ts).
    fn world(nlat: usize, nlon: usize) -> Grid {
        let mut g = Grid::new(nlat, nlon);
        for i in 0..g.n { let (lat, lon) = (g.p(LAT)[i], g.p(LON)[i]); let land = ((lon + 180.0) % 120.0 < 60.0 && lat.abs() < 70.0) || lat < -70.0; g.pm(LAND)[i] = if land { 1.0 } else { 0.0 }; g.pm(ELEV)[i] = if land { 300.0 } else { 0.0 }; }
        g.seed(80.0, 0.0); g
    }
    fn mean(g: &Grid, k: usize, lat0: f64, lat1: f64) -> f64 { let (mut s, mut w) = (0.0, 0.0); for i in 0..g.n { let l = g.p(LAT)[i]; if l >= lat0 && l < lat1 { let c = l.to_radians().cos(); s += g.p(k)[i] * c; w += c; } } s / w }
    #[test] fn seeded_planet_is_finite_and_layered() {
        let g = world(45, 90);
        for k in 0..PLANES { assert!(g.p(k).iter().all(|v| v.is_finite()), "plane {} not finite", NAMES[k]); }
        assert!(mean(&g, TS, -10.0, 10.0) > mean(&g, TS, 70.0, 90.0) + 20.0);
    }
    #[test] fn thirty_days_stay_physical() {
        let mut g = world(45, 90);
        for _ in 0..30 * 8 { g.step(3.0 * 3600.0); }
        for k in 0..PLANES { assert!(g.p(k).iter().all(|v| v.is_finite()), "plane {} not finite", NAMES[k]); }
        let (te, tp) = (mean(&g, TS, -10.0, 10.0), mean(&g, TS, 70.0, 90.0));
        println!("after 30 d: Ts equator {:.1} pole {:.1} global-ish {:.1}; precip eq {:.2} mm/d; evap eq {:.2}; |wind| mid-lat {:.1}", te, tp, mean(&g, TS, -90.0, 90.0), mean(&g, PRECIP, -10.0, 10.0), mean(&g, EVAP, -10.0, 10.0), mean(&g, U, 30.0, 60.0));
        assert!(te > tp + 15.0 && te < 45.0 && tp > -80.0);
        assert!(g.p(SOIL).iter().all(|&v| (0.0..=150.0 + 1e-9).contains(&v)));
        assert!(g.p(PRECIP).iter().all(|&v| v >= 0.0) && g.p(CLOUD).iter().all(|&v| (0.0..=1.0).contains(&v)));
    }
    #[test] fn coast_at_reads_the_containing_cell() {
        let mut g = Grid::new(18, 36);
        for i in 0..g.n { let lon = g.p(LON)[i]; g.pm(LAND)[i] = if (0.0..90.0).contains(&lon) { 1.0 } else { 0.0 }; }
        assert_eq!(g.coast_at(5.0, -60.0), 0.0);
        let near = g.coast_at(5.0, 5.0); let inland = g.coast_at(5.0, 45.0);
        assert!(near > 0.0 && inland > near, "{} {}", near, inland);
        assert_eq!(g.coast_at(5.0, 45.0 + 360.0), inland);
        assert!(g.coast_at(f64::NAN, 0.0).is_nan());
    }
    #[test] fn coast_distance_is_zero_on_water_and_grows_inland() {
        let mut g = Grid::new(12, 24);
        for i in 0..g.n { g.pm(LAND)[i] = if g.p(LON)[i] > 0.0 { 1.0 } else { 0.0 }; }
        g.refresh_coast();
        let row = g.nlat / 2;
        let mut near = f64::INFINITY;
        let mut inland = 0.0f64;
        for c in 0..g.nlon {
            let i = row * g.nlon + c;
            let lon = g.p(LON)[i];
            if g.p(LAND)[i] < 0.5 { assert_eq!(g.coast_m[i], 0.0, "water {}", lon); }
            else if lon < 20.0 { near = near.min(g.coast_m[i]); }
            else if (30.0..60.0).contains(&lon) { inland = inland.max(g.coast_m[i]); }
        }
        assert!(near.is_finite() && near > 0.0 && inland > near + 100_000.0, "near {} inland {}", near, inland);
    }
}
