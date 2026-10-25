//! Ordered fill of a grid whose land mask and elevation the host already wrote (T-0062, issue #46).
//! This is `Grid::seed` moved, not reordered. T-0063 owns Matthew's boot order. Boot here does not add a second mask.
use crate::grid::{Grid, ELEV, ICE, LAND, LAT, Q, SNOW, SOIL, SST, TAIR, TS};
use super::atmosphere::cloud_fraction::update_clouds;
use super::atmosphere::wind::update_wind;
use super::climate_seed::seed_cell;
use super::energy::energy_update::update_energy;
use super::hydrosphere::ice_fraction::ice_fraction_subgrid;
use super::hydrosphere::precipitation::update_moisture;
use super::hydrosphere::sst::sea_surface_temperature;

pub fn initialize(g: &mut Grid, day: f64, hour: f64) {
    g.day = day; g.hour = hour; g.row_day = -1.0;
    let t_bar = g.t_bar;
    for i in 0..g.n {
        let (lat, land, elev) = (g.p(LAT)[i], g.p(LAND)[i], g.p(ELEV)[i]);
        let s = seed_cell(day, lat, land, elev, t_bar);
        g.pm(TS)[i] = s.t_air; g.pm(TAIR)[i] = s.t_air; g.pm(SOIL)[i] = s.soil_mm; g.pm(SNOW)[i] = s.snow_mm; g.pm(Q)[i] = s.q;
        g.pm(SST)[i] = sea_surface_temperature(land, s.t_air);
        g.pm(ICE)[i] = if land < 0.5 { ice_fraction_subgrid(s.t_air, std::f64::consts::PI * 6371.0 / g.nlat as f64) } else { 0.0 };
    }
    update_clouds(g, 0.0);
    update_wind(g);
    update_energy(g, 1.0); // fills the diagnostics without moving the state
    update_moisture(g, 0.0);
}
