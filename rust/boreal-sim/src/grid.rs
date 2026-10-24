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
    pub row_land: Vec<f64>, pub row_sea: Vec<f64>, row_day: f64, pub t_bar: f64 }
impl Grid {
    pub fn new(nlat: usize, nlon: usize) -> Grid {
        let n = nlat * nlon; let mut g = Grid { nlat, nlon, n, day: 80.0, hour: 12.0, data: vec![0.0; n * PLANES], row_land: vec![0.0; nlat], row_sea: vec![0.0; nlat], row_day: -1.0, t_bar: annual_global_t() };
        for r in 0..nlat { for c in 0..nlon { let i = r * nlon + c;
            g.data[LAT * n + i] = -90.0 + (r as f64 + 0.5) * 180.0 / nlat as f64; g.data[LON * n + i] = -180.0 + (c as f64 + 0.5) * 360.0 / nlon as f64; } }
        g
    }
    #[inline] pub fn p(&self, k: usize) -> &[f64] { &self.data[k * self.n..(k + 1) * self.n] }
    #[inline] pub fn pm(&mut self, k: usize) -> &mut [f64] { let n = self.n; &mut self.data[k * n..(k + 1) * n] }
    /// Recompute the per-row climatological air temperature when the day has moved on by a quarter day or more.
    pub fn refresh_rows(&mut self) {
        if (self.day - self.row_day).abs() < 0.25 { return; }
        self.row_day = self.day;
        for r in 0..self.nlat { let lat = self.data[LAT * self.n + r * self.nlon];
            self.row_land[r] = damped_seed(self.day, lat, crate::surface_budget::LAND_HEATCAP, self.t_bar);
            self.row_sea[r] = damped_seed(self.day, lat, crate::surface_budget::OCEAN_HEATCAP, self.t_bar); }
    }
    /// Climate seed: fills the state planes from LAND and ELEV (which the caller has set) for `day`.
    pub fn seed(&mut self, day: f64, hour: f64) {
        self.day = day; self.hour = hour; self.row_day = -1.0;
        let t_bar = self.t_bar;
        for i in 0..self.n {
            let (lat, land, elev) = (self.p(LAT)[i], self.p(LAND)[i], self.p(ELEV)[i]);
            let s = seed_cell(day, lat, land, elev, t_bar);
            self.pm(TS)[i] = s.t_air; self.pm(TAIR)[i] = s.t_air; self.pm(SOIL)[i] = s.soil_mm; self.pm(SNOW)[i] = s.snow_mm; self.pm(Q)[i] = s.q;
            self.pm(SST)[i] = if land < 0.5 { s.t_air } else { -999.0 };
            self.pm(ICE)[i] = if land < 0.5 { crate::hydrosphere_budget::ice_fraction_subgrid(s.t_air, std::f64::consts::PI * 6371.0 / self.nlat as f64) } else { 0.0 };
        }
        crate::update_clouds::update_clouds(self);
        crate::update_wind::update_wind(self);
        crate::update_energy::update_energy(self, 1.0); // fills the diagnostics without moving the state
        crate::update_moisture::update_moisture(self, 0.0);
    }
    /// Advance `dt` seconds: energy, wind, moisture, clouds, in that order (each reads the previous step's other fields).
    pub fn step(&mut self, dt: f64) {
        crate::update_energy::update_energy(self, dt);
        crate::update_wind::update_wind(self);
        crate::update_moisture::update_moisture(self, dt);
        crate::update_clouds::update_clouds(self);
        let t = self.hour + dt / 3600.0; self.day = (self.day + (t / 24.0).floor() - 1.0).rem_euclid(365.0) + 1.0; self.hour = t.rem_euclid(24.0);
    }
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
}
