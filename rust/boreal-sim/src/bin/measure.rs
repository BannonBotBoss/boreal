use boreal_sim::formation::*; use boreal_sim::constants as C;
fn main() { let a: Vec<String> = std::env::args().collect(); let bytes = std::fs::read(&a[1]).unwrap(); let b: Vec<f32> = bytes.chunks(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
  let s = from_bake(&b, C::omega_earth); let f = measure(&s); let t: f64 = a[2].parse().unwrap(); let steps: usize = a[3].parse().unwrap();
  println!("{{\"n\":{},\"steps\":{},\"t_s\":{:.0},\"mass\":{:e},\"com_m\":{:e},\"r_vol\":{:.0},\"a\":{:.0},\"c\":{:.0},\"j2\":{:e},\"f_clairaut\":{:e},\"f_shape\":{:e},\"moi\":{:.4},\"g_eq\":{:.4},\"g_pole\":{:.4},\"rho_centre\":{:.0}}}", f.n, steps, t, f.mass, f.com, f.r_vol, f.a, f.c, f.j2, f.f_clairaut, f.f_shape, f.moi, f.g_eq, f.g_pole, f.rho_centre); }
