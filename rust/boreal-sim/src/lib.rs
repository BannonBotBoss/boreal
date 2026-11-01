//! boreal-sim: the planet budgets of issue #43 (solar, hydrosphere, atmosphere, surface) as WebAssembly for the Three.js app.
//! Plain `extern "C"` exports, no wasm-bindgen: the host calls `grid_init`, fills the LAND and ELEV planes through the pointer it
//! gets back, calls `grid_seed` and `grid_step`, and reads any plane as a `Float64Array` over the module's memory.
pub mod constants;
pub mod consts;
pub mod planet_fundamentals;
// Old module paths stay as names. The formulas live once under planet_fundamentals (T-0062, issue #46).
pub use planet_fundamentals::energy::solar_budget;
pub use planet_fundamentals::surface as surface_budget;
pub use planet_fundamentals::hydrosphere as hydrosphere_budget;
pub use planet_fundamentals::atmosphere as atmosphere_budget;
pub use planet_fundamentals::climate_seed;
pub use planet_fundamentals::energy::energy_update as update_energy;
pub use planet_fundamentals::hydrosphere::precipitation as update_moisture;
pub use planet_fundamentals::atmosphere::cloud_fraction as update_clouds;
pub use planet_fundamentals::atmosphere::wind as update_wind;
pub mod grid;
pub mod column_budget;
pub mod rt;
pub mod emergent;
pub mod sun_spectrum;
pub mod interior;
pub mod gas;
pub mod formation;
pub mod differentiation;
pub mod boot_order;
pub mod perception;
pub mod animals;
pub mod entities;
pub mod cover;
pub mod species;

use grid::Grid;
use std::cell::RefCell;
thread_local! { static GRID: RefCell<Option<Grid>> = const { RefCell::new(None) }; }

/// Version of the plane layout; bump when `grid::NAMES` changes.
#[no_mangle] pub extern "C" fn layout_version() -> u32 { 3 }
#[no_mangle] pub extern "C" fn plane_count() -> u32 { grid::PLANES as u32 }
/// Allocate an nlat × nlon grid; returns a pointer to plane 0 (planes are n f64 apart, n = nlat·nlon).
#[no_mangle] pub extern "C" fn grid_init(nlat: u32, nlon: u32) -> *mut f64 {
    GRID.with(|g| { let mut b = g.borrow_mut(); *b = Some(Grid::new(nlat as usize, nlon as usize)); b.as_mut().unwrap().data.as_mut_ptr() })
}
/// Seed the state from LAND and ELEV for a day of year and UTC hour (climate_seed).
#[no_mangle] pub extern "C" fn grid_seed(day: f64, hour: f64) { GRID.with(|g| if let Some(g) = g.borrow_mut().as_mut() { g.seed(day, hour) }) }
/// Advance dt game seconds.
#[no_mangle] pub extern "C" fn grid_step(dt: f64) { GRID.with(|g| if let Some(g) = g.borrow_mut().as_mut() { g.step(dt) }) }
/// Issue #47 boot: host has written LAND and ELEV. Fills the other planes in `boot_order::RUST_BOOT_STEPS`.
/// Does not advance the clock and does not call `update_energy`. `grid_seed` is unchanged.
#[no_mangle] pub extern "C" fn grid_boot(day: f64, hour: f64) { GRID.with(|g| if let Some(g) = g.borrow_mut().as_mut() { boot_order::boot(g, day, hour) }) }
#[no_mangle] pub extern "C" fn grid_day() -> f64 { GRID.with(|g| g.borrow().as_ref().map_or(0.0, |g| g.day)) }
#[no_mangle] pub extern "C" fn grid_hour() -> f64 { GRID.with(|g| g.borrow().as_ref().map_or(0.0, |g| g.hour)) }
/// Single-cell solar budget (the same functions weather.ts has in TypeScript), written into `out[0..6]`:
/// toa, sw_down, q_absorbed, q_reflected, q_longwave_out, lw_net. Used by the parity test.
#[no_mangle] pub extern "C" fn solar_cell(day: f64, utc_hour: f64, lat: f64, lon: f64, cloud: f64, albedo: f64, t_c: f64, e_pa: f64, out: *mut f64) {
    let s = solar_budget::solar(day, utc_hour, lat, lon, 0.0);
    let b = solar_budget::budget(&s, cloud, albedo, t_c, e_pa);
    let o = unsafe { std::slice::from_raw_parts_mut(out, 7) };
    o.copy_from_slice(&[b.toa, b.sw_down, b.q_absorbed, b.q_reflected, b.q_longwave_out, b.lw_net, s.cos_z]);
}
/// Memory helpers for hosts that need scratch space.
#[no_mangle] pub extern "C" fn alloc_f64(n: u32) -> *mut f64 { let mut v = vec![0.0f64; n as usize]; let p = v.as_mut_ptr(); std::mem::forget(v); p }
/// Radial profile along any outward vector (interior.rs): out[0..5] = layer, density kg/m3, temperature K, pressure Pa, gravity m/s2.
#[no_mangle] pub extern "C" fn radial_profile(r_km: f64, magnetopause_re: f64, out: *mut f64) {
    let o = unsafe { std::slice::from_raw_parts_mut(out, 5) }; o.copy_from_slice(&interior::profile(r_km, magnetopause_re)); }
/// Gas column (gas.rs) at altitude h km: out = [T, p, rho, n, x_N2, x_O2, x_Ar, x_CO2, x_H2O, x_O3, x_O, x_Na, x_He].
#[no_mangle] pub extern "C" fn gas_column(body: u32, h_km: f64, q_surf: f64, co2_ppm: f64, out: *mut f64) {
    let b = match body { 1 => gas::Body::Venus, 2 => gas::Body::Mercury, _ => gas::Body::Earth }; let c = gas::column(b, h_km, q_surf, co2_ppm);
    let o = unsafe { std::slice::from_raw_parts_mut(out, 13) }; o[..4].copy_from_slice(&[c.t, c.p, c.rho, c.n]); o[4..].copy_from_slice(&c.x); }
/// Emergent figure (interior.rs): out = [surface radius km, C/MR^2, flattening f, equatorial a km, polar c km].
#[no_mangle] pub extern "C" fn earth_figure(out: *mut f64) { let (f, a, c) = interior::figure();
    let o = unsafe { std::slice::from_raw_parts_mut(out, 5) }; o.copy_from_slice(&[interior::surface_radius_km(), interior::moi_factor(), f, a, c]); }
/// Normal gravity of the rotating figure at r m, geocentric latitude deg (gas.rs gravity).
#[no_mangle] pub extern "C" fn figure_gravity(r_m: f64, lat_deg: f64) -> f64 { gas::gravity(r_m, lat_deg) }
/// Column above h km (gas.rs): out = [n_col m^-2, O3 DU, pw mm, mass kg/m2, thermal layer index].
#[no_mangle] pub extern "C" fn gas_above(h_km: f64, q_surf: f64, co2_ppm: f64, out: *mut f64) { let a = gas::column_above(h_km, q_surf, co2_ppm);
    let o = unsafe { std::slice::from_raw_parts_mut(out, 5) }; o.copy_from_slice(&[a.n_col, a.o3_du, a.pw_mm, a.mass, gas::atmos_layer(h_km) as f64]); }
/// Shortwave column at a point (rt.rs, gas-fed): surf 0 ocean 1 sea ice 2 snow 3 land (land albedo given);
/// out = [toa, reflected by atmosphere+cloud, reflected by surface, absorbed atmosphere, absorbed surface, surface albedo, glint BRF, TSI].
#[no_mangle] pub extern "C" fn rt_point(year: f64, cos_z: f64, cos_v: f64, phi: f64, wind: f64, cloud: f64, tau: f64, surf: u32, land_albedo: f64, h_km: f64, q_surf: f64, co2_ppm: f64, out: *mut f64) {
    let s = match surf { 1 => rt::Surf::SeaIce, 2 => rt::Surf::Snow, 3 => rt::Surf::Land, _ => rt::Surf::Ocean }; let al = rt::surface_albedo(s, cos_z, land_albedo);
    let tsi = rt::tsi(year); let g = rt::gas_inputs(h_km, q_surf, co2_ppm); let k = rt::point(tsi * cos_z.max(0.0), cos_z, cloud, tau, al, &g);
    let gl = if s == rt::Surf::Ocean { rt::glint(cos_z, cos_v, phi, wind) } else { 0.0 };
    let o = unsafe { std::slice::from_raw_parts_mut(out, 8) }; o.copy_from_slice(&[k.toa, k.refl_atm, k.refl_surf, k.abs_atm, k.abs_surf, al, gl, tsi]); }
/// Emergent-object demo (emergent.rs) on PREM-sampled particles: mode 0 relaxed Earth, 1 the same particles unbound (3 v_esc),
/// 2 Earth + a 37-particle Moon at 384,400 km. out = [count, mass kg, com x y z m, spin z, members, trusted, extent m,
/// layers, secondary inside Hill, secondary outside Roche].
#[no_mangle] pub extern "C" fn emergent_demo(n: u32, mode: u32, out: *mut f64) { let n = n as usize; let mut p = emergent::sample_prem_earth(n, 7, if mode == 0 { constants::omega_earth } else { 0.0 });
    let mut r = emergent::Rng::new(3); let vesc = (2.0 * constants::GM_earth / constants::R_earth_mean).sqrt();
    if mode == 1 { for v in p.vel.iter_mut() { let d = r.dir(); *v = [3.0 * vesc * d[0], 3.0 * vesc * d[1], 3.0 * vesc * d[2]]; } }
    if mode == 2 { let k = (0.0123 * n as f64).round() as usize; let (dist, m) = (3.844e8, p.mass[0]); let vo = (constants::GM_earth / dist).sqrt();
        for _ in 0..k { let d = r.dir(); let a = 1.7374e6 * r.f().cbrt(); p.pos.push([dist + d[0] * a, d[1] * a, d[2] * a]); p.vel.push([0.0, vo, 0.0]); p.mass.push(m); p.mat.push(2); } }
    let o = emergent::find_objects(&p, emergent::earth_link(n)); let t = emergent::tidal(&o); let out = unsafe { std::slice::from_raw_parts_mut(out, 13) }; out.fill(0.0); out[0] = o.len() as f64;
    if let Some(e) = o.first() { out[1..12].copy_from_slice(&[e.mass, e.com[0], e.com[1], e.com[2], e.spin[2], e.members.len() as f64, e.trusted as u8 as f64, e.extent, e.layers.len() as f64, t.first().map_or(0.0, |x| x.inside_hill as u8 as f64), t.first().map_or(0.0, |x| x.outside_roche as u8 as f64)]); } }

/// Issue #167 cover row for one landing, written into `out[0..3]`: class id (0 water, 1 ice, 2 rock, 3 tundra, 4 desert,
/// 5 prairie, 6 boreal, 7 tropical, 8 wetland), stems per hectare, billboard height in metres. Deterministic per (lat, lon).
#[no_mangle] pub extern "C" fn cover_cell(lat: f64, lon: f64, elev_m: f64, vegetation: f64, water: u32, out: *mut f64) {
    let r = cover::cover_row(lat, lon, elev_m, vegetation, water != 0);
    let o = unsafe { std::slice::from_raw_parts_mut(out, 3) };
    o.copy_from_slice(&[r.class as u32 as f64, r.stems_per_ha, r.height_m]);
}

/// Animals per hectare for one species at one landing in one year (0 snowshoe hare, 1 white-tailed deer, 2 moose, 3 Canada lynx, 4 gray wolf, 5 caribou).
/// Zero outside the species' range or on cover it cannot use. Deterministic per (species, lat, lon, year).
#[no_mangle] pub extern "C" fn species_density(species: u32, lat: f64, lon: f64, elev_m: f64, vegetation: f64, water: u32, year: i32) -> f64 {
    species::Species::from_id(species).map_or(0.0, |s| species::density_per_ha(s, lat, lon, elev_m, vegetation, water != 0, year))
}
/// Whole animals to spawn in a square patch `side_m` wide at that density.
#[no_mangle] pub extern "C" fn species_spawn_count(density_per_ha: f64, side_m: f64, lat: f64, lon: f64) -> u32 {
    species::spawn_count(density_per_ha, side_m, lat, lon)
}
/// Issue #162 bridge: the local population list for one landing, written as (species id, count) pairs into `out`
/// (room for `cap` pairs, so 2·cap f64). Returns the number of pairs written. Species ids as in `species_density`.
#[no_mangle] pub extern "C" fn landing_population(lat: f64, lon: f64, elev_m: f64, vegetation: f64, water: u32, year: i32, side_m: f64, out: *mut f64, cap: u32) -> u32 {
    let pop = species::landing_population(lat, lon, elev_m, vegetation, water != 0, year, side_m);
    let n = pop.len().min(cap as usize);
    let o = unsafe { std::slice::from_raw_parts_mut(out, 2 * n) };
    for (i, &(s, c)) in pop.iter().take(n).enumerate() { o[2 * i] = s as u32 as f64; o[2 * i + 1] = c as f64; }
    n as u32
}
