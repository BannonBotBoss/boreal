//! Hot differentiation run: bulk mix (iron + named silicate), Tillotson with u, RB22 densities, GDF forces.
//! Usage: hot <n_target> <steps> <damp> <silicate> [out.bin] [cool_steps] [cool_frac]. Cooling phase follows the hot phase. Prints figure + emergent boundaries; writes bake + JSON.
use boreal_sim::differentiation::*; use boreal_sim::constants as C;
fn line(s: &Hot, k: usize, t: f64) -> String { let f = s.measure(); let b = s.boundaries();
  format!("{{\"step\":{k},\"t_s\":{t:.0},\"n\":{},\"mass\":{:e},\"com_m\":{:.1},\"r_vol\":{:.0},\"inv_f\":{:.1},\"j2\":{:.4e},\"moi\":{:.4},\"g_eq\":{:.3},\"g_pole\":{:.3},\"rho_centre\":{:.0},\"vmax\":{:.1},\"separation\":{:.3},\"cmb\":{:.0},\"n_solid\":{},\"icb\":{:.0},\"t_centre\":{:.0},\"p_centre\":{:.4e},\"heat_damping_J\":{:.3e},\"heat_removed_J\":{:.3e}}}",
    f.n, f.mass, f.com, f.r_vol, 1.0 / f.f_clairaut, f.j2, f.moi, f.g_eq, f.g_pole, f.rho_centre, f.vmax, b.separation, b.cmb, b.n_solid, b.icb, b.t_centre, b.p_centre, s.heat_from_damping, s.heat_removed) }
fn main() { let a: Vec<String> = std::env::args().collect(); let n: usize = a[1].parse().unwrap(); let steps: usize = a[2].parse().unwrap(); let damp: f64 = a[3].parse().unwrap();
  let mut s = Hot::mix(n, 7, &a[4], C::omega_earth); let mut t = 0.0; println!("{}", line(&s, 0, 0.0));
  for k in 1..=steps { t += s.step(damp); if k % (steps / 25).max(1) == 0 || k == steps { println!("{}", line(&s, k, t)); } }
  let cs: usize = a.get(6).map(|x| x.parse().unwrap()).unwrap_or(0); let cf: f64 = a.get(7).map(|x| x.parse().unwrap()).unwrap_or(0.01);
  for k in 1..=cs { t += s.step(damp); s.cool_toward_adiabat(cf); if k % (cs / 25).max(1) == 0 || k == cs { println!("{}", line(&s, steps + k, t)); } }
  let steps = steps + cs;
  if a.len() > 5 { std::fs::write(&a[5], s.bake().iter().flat_map(|x| x.to_le_bytes()).collect::<Vec<u8>>()).unwrap();
    std::fs::write(format!("{}.json", a[5].trim_end_matches(".bin")), line(&s, steps, t)).unwrap(); } }
