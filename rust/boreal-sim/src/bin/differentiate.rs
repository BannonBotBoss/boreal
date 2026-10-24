//! Differentiation from a bulk mix: undifferentiated iron + silicate parcels settle under gravity and spin.
//! Usage: differentiate <n_target> <steps> <damp> [out.bin]. Prints the figure and the emergent core-mantle boundary.
use boreal_sim::formation::*; use boreal_sim::constants as C;
fn main() { let a: Vec<String> = std::env::args().collect(); let n: usize = a[1].parse().unwrap(); let steps: usize = a[2].parse().unwrap(); let damp: f64 = a[3].parse().unwrap();
  let (p, rho0) = form_mix_ic(n, 7); let mut s = State::from_mix(p, C::omega_earth, rho0); let mut t = 0.0;
  for k in 0..steps { t += s.step(damp); if k % (steps / 20).max(1) == 0 || k == steps - 1 { let f = measure(&s); let b = boundaries(&s);
    println!("step {k} t {:.0} s rvol {:.0} km 1/f {:.0} J2 {:.3e} moi {:.4} geq {:.3} gp {:.3} rhoc {:.0} vmax {:.0} | cmb {:.0} km sep {:.3}", t, f.r_vol / 1e3, 1.0 / f.f_clairaut, f.j2, f.moi, f.g_eq, f.g_pole, f.rho_centre, f.vmax, b.cmb / 1e3, b.separation); } }
  if a.len() > 4 { let b = bake(&s); std::fs::write(&a[4], b.iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>()).unwrap(); } }
