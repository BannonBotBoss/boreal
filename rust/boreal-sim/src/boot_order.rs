//! Globe boot order (issue #47, T-0063). One pass over a grid whose latitude and longitude `Grid::new` already
//! wrote. The host writes the land/sea mask and the elevation, then `boot` runs the rest. This does not advance
//! the clock and it does not integrate surface temperature (`update_energy` stays on `Grid::step`).
//!
//! `Grid::seed` is the older T-0061 fill. A later move of that function (issue #46) must keep calling it in its
//! own order. This list is the boot contract: the only call order is the `for step in RUST_BOOT_STEPS` loop.
//! The names are the ones `lib.rs` re-exports, so `crate::climate_seed`, `crate::surface_budget`,
//! `crate::update_clouds`, `crate::update_wind`, `crate::update_moisture`, `crate::solar_budget`,
//! `crate::hydrosphere_budget` and `crate::atmosphere_budget` stay the call sites.

use crate::atmosphere_budget::surface_pressure;
use crate::climate_seed::{seed_cell, Seeded};
use crate::consts::{P0, S0};
use crate::grid::*;
use crate::hydrosphere_budget::{column_water, ice_fraction_subgrid, surface_balance};
use crate::solar_budget::{budget, shortwave, solar};
use crate::surface_budget::{beta, cell_surface};

/// Rust half of Matthew's list. Land/sea mask and "render globe" are the host (planet.ts, then the globe loop).
pub const RUST_BOOT_STEPS: &[&str] = &[
    "elevation_roughness",
    "climate_bands",
    "sst_soil_humidity",
    "cloud_seed",
    "solar_budget",
    "surface_absorption",
    "pressure",
    "wind",
    "hydrosphere_flows",
    "atmosphere_updates",
    "finalize",
];

/// Fill every derived plane. `day` and `hour` are the instant; they are stored and not stepped.
pub fn boot(g: &mut Grid, day: f64, hour: f64) {
    g.day = day;
    g.hour = hour;
    for k in 4..PLANES { g.pm(k).fill(0.0); }
    let mut seeds: Vec<Seeded> = Vec::new();
    for step in RUST_BOOT_STEPS {
        match *step {
            "elevation_roughness" => elevation_roughness(g),
            "climate_bands" => { seeds = climate_bands(g); }
            "sst_soil_humidity" => sst_soil_humidity(g, &mut seeds),
            "cloud_seed" => { let _ = crate::update_clouds::update_clouds(g, 0.0); }
            "solar_budget" => solar_budget(g),
            "surface_absorption" => surface_absorption(g),
            "pressure" => pressure(g),
            "wind" => { crate::update_wind::update_wind(g); }
            "hydrosphere_flows" => hydrosphere_flows(g),
            "atmosphere_updates" => atmosphere_updates(g),
            "finalize" => { let _ = planes_finite(g); }
            other => panic!("unwired boot step {other}"),
        }
    }
}

/// Roughness from `cell_surface` while soil, snow and ice are still the cleared planes (step 2, before the bucket seed).
fn elevation_roughness(g: &mut Grid) {
    let n = g.n;
    for i in 0..n {
        let z0 = cell_surface(g.p(LAND)[i], g.p(SOIL)[i], g.p(SNOW)[i], g.p(ICE)[i]).z0;
        g.pm(ROUGH)[i] = z0;
    }
}

fn remember(g: &Grid) -> Vec<Seeded> {
    let t_bar = g.t_bar;
    (0..g.n).map(|i| seed_cell(g.day, g.p(LAT)[i], g.p(LAND)[i], g.p(ELEV)[i], t_bar)).collect()
}

/// Zonal temperature only (Budyko 1969 / North & Coakley 1979 via `seed_cell`). Soil and humidity stay for the next step.
fn climate_bands(g: &mut Grid) -> Vec<Seeded> {
    let seeds = remember(g);
    for (i, s) in seeds.iter().enumerate() { g.pm(TS)[i] = s.t_air; g.pm(TAIR)[i] = s.t_air; }
    seeds
}

/// SST and specific humidity from the climate seed; soil moisture from the Manabe 1969 bucket inside `seed_cell`.
fn sst_soil_humidity(g: &mut Grid, seeds: &mut Vec<Seeded>) {
    if seeds.len() != g.n { *seeds = remember(g); }
    let dy_km = std::f64::consts::PI * 6371.0 / g.nlat as f64; // same cell height Grid::seed passes to ice_fraction_subgrid
    for (i, s) in seeds.iter().enumerate() {
        let land = g.p(LAND)[i];
        g.pm(SOIL)[i] = s.soil_mm;
        g.pm(SNOW)[i] = s.snow_mm;
        g.pm(Q)[i] = s.q;
        g.pm(SST)[i] = if land < 0.5 { s.t_air } else { -999.0 }; // land sentinel, same as Grid::seed
        g.pm(ICE)[i] = if land < 0.5 { ice_fraction_subgrid(s.t_air, dy_km) } else { 0.0 };
    }
}

fn solar_budget(g: &mut Grid) {
    let n = g.n;
    for i in 0..n {
        let sun = solar(g.day, g.hour, g.p(LAT)[i], g.p(LON)[i], 0.0);
        g.pm(TOA)[i] = sun.toa;
        g.pm(SWDOWN)[i] = shortwave(sun.cos_z, g.p(CLOUD)[i], S0);
    }
}

/// `solar_budget::budget` writes absorbed shortwave. Surface temperature is not stepped.
fn surface_absorption(g: &mut Grid) {
    let n = g.n;
    for i in 0..n {
        let ts = g.p(TS)[i];
        let (land, soil, swe, ice) = (g.p(LAND)[i], g.p(SOIL)[i], g.p(SNOW)[i], g.p(ICE)[i]);
        let cs = cell_surface(land, soil, swe, ice);
        let sun = solar(g.day, g.hour, g.p(LAT)[i], g.p(LON)[i], 0.0);
        // Vapour pressure for the longwave term, the same q·p/0.622 `update_energy` passes. Pressure is computed
        // here only as that input; the pressure plane is the next step.
        let p = surface_pressure(P0, g.p(ELEV)[i].max(0.0), g.p(TAIR)[i]);
        let b = budget(&sun, g.p(CLOUD)[i], cs.albedo, ts, g.p(Q)[i] * p / 0.622);
        g.pm(QABS)[i] = b.q_absorbed;
        g.pm(QREFL)[i] = b.q_reflected;
        g.pm(LWOUT)[i] = b.q_longwave_out;
        g.pm(LWNET)[i] = b.lw_net;
        g.pm(ALBEDO)[i] = cs.albedo;
        g.pm(HEATCAP)[i] = cs.heatcap;
        g.pm(SNOWFRAC)[i] = cs.snow;
        g.pm(SEAFRAC)[i] = cs.sea_fraction;
        g.pm(TS)[i] = ts;
    }
}

/// Hydrostatic surface pressure, `AIR.p0` = ISO 2533 via `P0`.
fn pressure(g: &mut Grid) {
    let n = g.n;
    for i in 0..n {
        g.pm(PRESSURE)[i] = surface_pressure(P0, g.p(ELEV)[i].max(0.0), g.p(TAIR)[i]);
    }
}

/// Penman–Monteith evaporation (`surface_balance`) and `update_moisture` at dt = 0 so the bucket is not stepped.
fn hydrosphere_flows(g: &mut Grid) {
    let n = g.n;
    for i in 0..n {
        let (land, soil, swe, ice) = (g.p(LAND)[i], g.p(SOIL)[i], g.p(SNOW)[i], g.p(ICE)[i]);
        let cs = cell_surface(land, soil, swe, ice);
        let wind = g.p(U)[i].hypot(g.p(V)[i]).max(2.0);
        let b = surface_balance(cs.albedo, cs.rs, cs.z0, land < 0.5, g.p(SWDOWN)[i], g.p(TS)[i], g.p(Q)[i], g.p(PRESSURE)[i], wind, g.p(CLOUD)[i], beta(soil));
        g.pm(EVAP)[i] = b.evap * 86400.0; // mm/day, same conversion as update_energy
    }
    crate::update_moisture::update_moisture(g, 0.0);
}

/// Refresh cloud fraction, optical depth and the humidity column from the flows just computed.
fn atmosphere_updates(g: &mut Grid) {
    crate::update_clouds::update_clouds(g, 0.0);
    let n = g.n;
    for i in 0..n {
        g.pm(PW)[i] = column_water(g.p(Q)[i], g.p(PRESSURE)[i], g.p(TAIR)[i]);
    }
}

fn planes_finite(g: &Grid) -> bool {
    (0..PLANES).all(|k| g.p(k).iter().all(|v| v.is_finite()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn world() -> Grid {
        let mut g = Grid::new(18, 36);
        for i in 0..g.n {
            let (lat, lon) = (g.p(LAT)[i], g.p(LON)[i]);
            let land = ((lon + 180.0) % 120.0 < 60.0 && lat.abs() < 70.0) || lat < -70.0;
            g.pm(LAND)[i] = if land { 1.0 } else { 0.0 };
            g.pm(ELEV)[i] = if land { 300.0 } else { 0.0 };
        }
        boot(&mut g, 80.0, 15.0);
        g
    }

    #[test]
    fn order_is_the_issue_list() {
        assert_eq!(RUST_BOOT_STEPS, &[
            "elevation_roughness", "climate_bands", "sst_soil_humidity", "cloud_seed", "solar_budget",
            "surface_absorption", "pressure", "wind", "hydrosphere_flows", "atmosphere_updates", "finalize",
        ]);
    }

    #[test]
    fn boot_does_not_advance_time_or_integrate_ts() {
        let g = world();
        assert_eq!(g.day, 80.0);
        assert_eq!(g.hour, 15.0);
        for i in 0..g.n { assert_eq!(g.p(TS)[i], g.p(TAIR)[i], "cell {i} Ts moved"); }
    }

    #[test]
    fn roughness_is_the_pre_bucket_surface() {
        let g = world();
        let bare = cell_surface(1.0, 0.0, 0.0, 0.0).z0;
        let forest = cell_surface(1.0, 0.5 * crate::consts::BUCKET_MM, 0.0, 0.0).z0;
        let ocean = cell_surface(0.0, 0.0, 0.0, 0.0).z0;
        assert!(forest > bare * 10.0, "forest z0 {forest} should dwarf bare {bare}");
        for i in 0..g.n {
            let expect = if g.p(LAND)[i] > 0.5 { bare } else { ocean };
            assert!((g.p(ROUGH)[i] - expect).abs() < 1e-12, "cell {i} rough {} != {expect}", g.p(ROUGH)[i]);
        }
    }

    #[test]
    fn seed_fields_pressure_and_budget_close() {
        let g = world();
        assert!(planes_finite(&g));
        let (mut land_soil, mut ocean_p, mut sun, mut wind) = (true, true, false, false);
        for i in 0..g.n {
            if g.p(LAND)[i] > 0.5 {
                land_soil &= (g.p(SOIL)[i] - 0.5 * crate::consts::BUCKET_MM).abs() < 1e-9;
                assert_eq!(g.p(SST)[i], -999.0);
            } else {
                assert_eq!(g.p(SST)[i], g.p(TS)[i]);
                if g.p(ELEV)[i] == 0.0 { ocean_p &= (g.p(PRESSURE)[i] - P0).abs() < 1e-6; }
            }
            let sw = g.p(SWDOWN)[i];
            assert!((g.p(QABS)[i] + g.p(QREFL)[i] - sw).abs() < 1e-6, "cell {i} budget");
            if sw > 1.0 { sun = true; }
            if g.p(U)[i].hypot(g.p(V)[i]) > 0.1 { wind = true; }
            assert!((0.0..=1.0).contains(&g.p(CLOUD)[i]));
            assert!(g.p(PW)[i] >= 0.0 && g.p(EVAP)[i] >= 0.0 && g.p(PRECIP)[i] >= 0.0);
        }
        assert!(land_soil && ocean_p && sun && wind, "soil {land_soil} pressure {ocean_p} sun {sun} wind {wind}");
    }
}
