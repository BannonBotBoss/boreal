//! Per-tick advance, moved from `Grid::step` (T-0062, issue #46). The order is unchanged:
//! energy, wind, moisture, clouds. T-0063 owns the boot order, not this step.
use crate::grid::Grid;
use super::atmosphere::cloud_fraction::update_clouds;
use super::atmosphere::wind::update_wind;
use super::energy::energy_update::update_energy;
use super::hydrosphere::precipitation::update_moisture;

pub fn advance(g: &mut Grid, dt: f64) {
    update_energy(g, dt);
    update_wind(g);
    update_moisture(g, dt);
    update_clouds(g, dt);
    let t = g.hour + dt / 3600.0; g.day = (g.day + (t / 24.0).floor() - 1.0).rem_euclid(365.0) + 1.0; g.hour = t.rem_euclid(24.0);
}
