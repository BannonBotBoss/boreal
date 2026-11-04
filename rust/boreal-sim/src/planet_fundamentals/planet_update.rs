//! Per-tick advance, moved from `Grid::step` (T-0062, issue #46). The order is unchanged:
//! energy, wind, moisture, clouds. T-0063 owns the boot order, not this step.
use crate::grid::Grid;
use super::atmosphere::cloud_fraction::update_clouds;
use super::atmosphere::wind::update_wind;
use super::energy::energy_update::update_energy;
use super::hydrosphere::precipitation::update_moisture;

pub fn advance(g: &mut Grid, dt: f64) {
    let started = crate::registry::now_ms();
    update_energy(g, dt);
    crate::registry::note("energy", started, g.day, g.hour, &[]);
    update_wind(g);
    crate::registry::note("wind", started, g.day, g.hour, &[]);
    update_moisture(g, dt);
    crate::registry::note("hydro", started, g.day, g.hour, &[]);
    update_clouds(g, dt);
    crate::registry::note("clouds", started, g.day, g.hour, &[]);
    let t = g.hour + dt / 3600.0; g.day = (g.day + (t / 24.0).floor() - 1.0).rem_euclid(365.0) + 1.0; g.hour = t.rem_euclid(24.0);
    crate::registry::note("grid step", started, g.day, g.hour, &[crate::registry::Var { label: "step".into(), unit: "s".into(), value: dt, min: dt, max: dt, n: 1 }]);
}
