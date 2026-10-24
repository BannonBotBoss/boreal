//! Radial profile of a parcel body vs PREM: shell-binned true density (mass / shell volume), mean SPH density, PREM.
//! Usage: profile <bake.bin | ic:NBASE> [bins]  -> CSV r_km,rho_shell,rho_sph,rho_prem,n
use boreal_sim::formation::*; use boreal_sim::constants as C; use boreal_sim::interior::prem_density;
fn main() { let a: Vec<String> = std::env::args().collect(); let bins: usize = a.get(2).map(|s| s.parse().unwrap()).unwrap_or(32);
  let s = if let Some(nb) = a[1].strip_prefix("ic:") { State::new(form_ic(nb.parse().unwrap(), 5), C::omega_earth) } else {
    let bytes = std::fs::read(&a[1]).unwrap(); let b: Vec<f32> = bytes.chunks(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect(); from_bake(&b, C::omega_earth) };
  for r in radial_profile(&s, 6.5e6, bins) { println!("{:.1},{:.0},{:.0},{:.0},{}", r.0 / 1e3, r.1, r.2, prem_density(r.0 / 1e3).0 * 1e3, r.3); } }
