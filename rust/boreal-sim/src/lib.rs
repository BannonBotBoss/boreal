//! boreal-sim: the planet budgets of issue #43 (solar, hydrosphere, atmosphere, surface) as WebAssembly for the Three.js app.
//! Plain `extern "C"` exports, no wasm-bindgen: the host calls `grid_init`, fills the LAND and ELEV planes through the pointer it
//! gets back, calls `grid_seed` and `grid_step`, and reads any plane as a `Float64Array` over the module's memory.
pub mod consts;
pub mod solar_budget;
pub mod surface_budget;
pub mod hydrosphere_budget;
pub mod atmosphere_budget;
pub mod climate_seed;
pub mod grid;
pub mod update_energy;
pub mod update_moisture;
pub mod update_clouds;
pub mod column_budget;
pub mod update_wind;
pub mod sun_spectrum;

use grid::Grid;
use std::cell::RefCell;
thread_local! { static GRID: RefCell<Option<Grid>> = const { RefCell::new(None) }; }

/// Version of the plane layout; bump when `grid::NAMES` changes.
#[no_mangle] pub extern "C" fn layout_version() -> u32 { 2 }
#[no_mangle] pub extern "C" fn plane_count() -> u32 { grid::PLANES as u32 }
/// Allocate an nlat × nlon grid; returns a pointer to plane 0 (planes are n f64 apart, n = nlat·nlon).
#[no_mangle] pub extern "C" fn grid_init(nlat: u32, nlon: u32) -> *mut f64 {
    GRID.with(|g| { let mut b = g.borrow_mut(); *b = Some(Grid::new(nlat as usize, nlon as usize)); b.as_mut().unwrap().data.as_mut_ptr() })
}
/// Seed the state from LAND and ELEV for a day of year and UTC hour (climate_seed).
#[no_mangle] pub extern "C" fn grid_seed(day: f64, hour: f64) { GRID.with(|g| if let Some(g) = g.borrow_mut().as_mut() { g.seed(day, hour) }) }
/// Advance dt game seconds.
#[no_mangle] pub extern "C" fn grid_step(dt: f64) { GRID.with(|g| if let Some(g) = g.borrow_mut().as_mut() { g.step(dt) }) }
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
