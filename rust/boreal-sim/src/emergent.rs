//! Stage 5 (T-0070): emergent objects from particles (Matt: "when the numbers cross a threshold, they create an object with
//! mass"). Method only, no code reused (SUBFIND is GPL): friends-of-friends grouping (Davis, Efstathiou, Frenk & White 1985,
//! ApJ 292:371; linking length b (V/N)^(1/3), b = 0.2), then an unbinding pass per group in its centre-of-mass frame (Springel
//! et al. 2001, MNRAS 328:726, sec. 3: iteratively drop particles with positive total energy). A group needs >= 20 particles
//! to exist and >= 100 for its properties to be trusted (resolution convention used across halo finders, e.g. the comparison of Knebe et al.
//! 2011, MNRAS 415:2293). An object's centre of mass becomes its radial-axis origin; mass and spin are summed over its
//! particles; layers come from sorting its materials by mean radius. Tidal checks: Hill radius a (m / 3M)^(1/3) (Hill 1878)
//! and the fluid Roche limit 2.44 R_p (rho_p / rho_s)^(1/3) (Roche 1849; Chandrasekhar 1969).
//! Not wired to the globe's bodies (that is the T-0070 particle migration, which awaits approval); the demo samples PREM.
use crate::constants as C;
use std::collections::HashMap;

pub type V3 = [f64; 3];
fn sub(a: V3, b: V3) -> V3 { [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
fn dot(a: V3, b: V3) -> f64 { a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
fn cross(a: V3, b: V3) -> V3 { [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] }
#[derive(Clone, Default)] pub struct Particles { pub pos: Vec<V3>, pub vel: Vec<V3>, pub mass: Vec<f64>, pub mat: Vec<u8> }
#[derive(Clone, Debug)] pub struct Layer { pub mat: u8, pub mass: f64, pub mean_r: f64 }
#[derive(Clone, Debug)] pub struct Object { pub members: Vec<usize>, pub mass: f64, pub com: V3, pub vcm: V3, pub spin: V3, pub extent: f64, pub trusted: bool, pub layers: Vec<Layer> }
pub const MIN_EXIST: usize = 20; pub const MIN_TRUST: usize = 100; pub const B_DAVIS: f64 = 0.2;
pub fn davis_link(b: f64, volume: f64, n: usize) -> f64 { b * (volume / n as f64).cbrt() }

fn find(p: &mut Vec<usize>, mut i: usize) -> usize { while p[i] != i { p[i] = p[p[i]]; i = p[i]; } i }
/// Friends-of-friends: groups of particles chained by separations < link (cell hash of size link, 27 neighbours).
pub fn fof(pos: &[V3], link: f64) -> Vec<Vec<usize>> {
    let key = |x: &V3| ((x[0] / link).floor() as i64, (x[1] / link).floor() as i64, (x[2] / link).floor() as i64);
    let mut cells: HashMap<(i64, i64, i64), Vec<usize>> = HashMap::new(); for (i, x) in pos.iter().enumerate() { cells.entry(key(x)).or_default().push(i); }
    let mut par: Vec<usize> = (0..pos.len()).collect(); let l2 = link * link;
    for (i, x) in pos.iter().enumerate() { let (a, b, c) = key(x);
        for da in -1..=1 { for db in -1..=1 { for dc in -1..=1 { if let Some(v) = cells.get(&(a + da, b + db, c + dc)) { for &j in v { if j > i { let d = sub(pos[j], *x); if dot(d, d) < l2 {
            let (ri, rj) = (find(&mut par, i), find(&mut par, j)); if ri != rj { par[ri] = rj; } } } } } } } } }
    let mut g: HashMap<usize, Vec<usize>> = HashMap::new(); for i in 0..pos.len() { let r = find(&mut par, i); g.entry(r).or_default().push(i); }
    let mut out: Vec<Vec<usize>> = g.into_values().collect(); out.sort_by_key(|v| std::cmp::Reverse(v.len())); out }
fn com(p: &Particles, m: &[usize]) -> (f64, V3, V3) { let mut s = 0.0; let mut c = [0.0; 3]; let mut v = [0.0; 3];
    for &i in m { s += p.mass[i]; for k in 0..3 { c[k] += p.mass[i] * p.pos[i][k]; v[k] += p.mass[i] * p.vel[i][k]; } } for k in 0..3 { c[k] /= s; v[k] /= s; } (s, c, v) }
/// Unbinding: drop particles whose kinetic + potential energy in the group frame is positive, repeat until stable.
pub fn unbind(p: &Particles, mut m: Vec<usize>, soft: f64) -> Vec<usize> {
    loop { if m.len() < MIN_EXIST { return m; } let (_, _, vcm) = com(p, &m);
        let keep: Vec<usize> = m.iter().copied().filter(|&i| { let mut phi = 0.0; for &j in &m { if j != i { let d = sub(p.pos[j], p.pos[i]); phi -= C::G * p.mass[j] / (dot(d, d) + soft * soft).sqrt(); } }
            let dv = sub(p.vel[i], vcm); 0.5 * dot(dv, dv) + phi < 0.0 }).collect();
        if keep.len() == m.len() { return m; } m = keep; } }
pub fn find_objects(p: &Particles, link: f64) -> Vec<Object> {
    let mut out = Vec::new();
    for g in fof(&p.pos, link) { if g.len() < MIN_EXIST { break; } let m = unbind(p, g, link / 4.0); if m.len() < MIN_EXIST { continue; }
        let (mass, c, v) = com(p, &m); let mut spin = [0.0; 3]; let mut ext: f64 = 0.0; let mut lay: HashMap<u8, (f64, f64)> = HashMap::new();
        for &i in &m { let r = sub(p.pos[i], c); let l = cross(r, sub(p.vel[i], v)); for k in 0..3 { spin[k] += p.mass[i] * l[k]; } let d = dot(r, r).sqrt(); ext = ext.max(d);
            let e = lay.entry(p.mat[i]).or_insert((0.0, 0.0)); e.0 += p.mass[i]; e.1 += p.mass[i] * d; }
        let mut layers: Vec<Layer> = lay.into_iter().map(|(mat, (ms, mr))| Layer { mat, mass: ms, mean_r: mr / ms }).collect(); layers.sort_by(|a, b| a.mean_r.partial_cmp(&b.mean_r).unwrap());
        out.push(Object { trusted: m.len() >= MIN_TRUST, members: m, mass, com: c, vcm: v, spin, extent: ext, layers }); }
    out.sort_by(|a, b| b.mass.partial_cmp(&a.mass).unwrap()); out }
#[derive(Clone, Copy, Debug)] pub struct Tidal { pub dist: f64, pub hill: f64, pub roche: f64, pub inside_hill: bool, pub outside_roche: bool }
/// For each secondary against the most massive object.
pub fn tidal(objs: &[Object]) -> Vec<Tidal> { if objs.is_empty() { return vec![]; } let p = &objs[0]; let rho = |o: &Object| o.mass / (4.0 / 3.0 * std::f64::consts::PI * o.extent.powi(3));
    objs[1..].iter().map(|s| { let d = dot(sub(s.com, p.com), sub(s.com, p.com)).sqrt(); let hill = d * (s.mass / (3.0 * p.mass)).cbrt(); let roche = 2.44 * p.extent * (rho(p) / rho(s)).cbrt();
        Tidal { dist: d, hill, roche, inside_hill: s.extent < hill, outside_roche: d > roche } }).collect() }

/// Deterministic sampler (xorshift64*) for tests and the demo.
pub struct Rng(u64); impl Rng { pub fn new(s: u64) -> Self { Rng(s.max(1)) } pub fn f(&mut self) -> f64 { self.0 ^= self.0 >> 12; self.0 ^= self.0 << 25; self.0 ^= self.0 >> 27; (self.0.wrapping_mul(2685821657736338717) >> 11) as f64 / (1u64 << 53) as f64 }
    pub fn dir(&mut self) -> V3 { let z = 2.0 * self.f() - 1.0; let a = 2.0 * std::f64::consts::PI * self.f(); let s = (1.0 - z * z).sqrt(); [s * a.cos(), s * a.sin(), z] } }
/// Equal-mass particles drawn from the PREM mass distribution (inverse CDF of interior::enclosed_mass), rigidly rotating
/// about +z at omega (a relaxed Earth); material = PREM layer index.
pub fn sample_prem_earth(n: usize, seed: u64, omega: f64) -> Particles { let mut r = Rng::new(seed); let mt = crate::interior::enclosed_mass(6371.0); let mut p = Particles::default();
    for _ in 0..n { let u = r.f() * mt; let (mut lo, mut hi) = (0.0, 6371.0); for _ in 0..40 { let m = 0.5 * (lo + hi); if crate::interior::enclosed_mass(m) < u { lo = m } else { hi = m } }
        let rad = 0.5 * (lo + hi) * 1e3; let d = r.dir(); let x = [d[0] * rad, d[1] * rad, d[2] * rad];
        p.pos.push(x); p.vel.push([-omega * x[1], omega * x[0], 0.0]); p.mass.push(mt / n as f64); p.mat.push(crate::interior::prem_density(rad / 1e3).1 as u8); } p }
pub fn earth_link(n: usize) -> f64 { davis_link(B_DAVIS, (20.0 * C::R_earth_mean).powi(3), n) } // domain: a 20 R_E box

#[cfg(test)]
mod tests { use super::*;
    #[test] fn relaxed_earth_is_one_object() { let n = 3000; let p = sample_prem_earth(n, 7, C::omega_earth); let o = find_objects(&p, earth_link(n));
        assert_eq!(o.len(), 1, "objects {}", o.len()); let e = &o[0]; assert!(e.trusted && e.members.len() == n);
        assert!((e.mass / C::M_earth - 1.0).abs() < 0.01, "mass {}", e.mass); assert!(dot(e.com, e.com).sqrt() < 200e3, "com offset {}", dot(e.com, e.com).sqrt());
        let i_pred = C::earth_moi_prem * C::M_earth * C::R_earth_mean.powi(2) * C::omega_earth; assert!((e.spin[2] / i_pred - 1.0).abs() < 0.05, "spin {} vs C w {}", e.spin[2], i_pred);
        let names: Vec<u8> = e.layers.iter().map(|l| l.mat).collect(); assert_eq!(&names[..3], &[0, 1, 2], "layers sorted by radius {names:?}"); }
    #[test] fn unbound_particles_make_none() { let n = 3000; let mut p = sample_prem_earth(n, 7, 0.0); let mut r = Rng::new(3); let vesc = (2.0 * C::GM_earth / C::R_earth_mean).sqrt();
        for v in p.vel.iter_mut() { let d = r.dir(); *v = [3.0 * vesc * d[0], 3.0 * vesc * d[1], 3.0 * vesc * d[2]]; }
        assert!(find_objects(&p, earth_link(n)).is_empty());
        let mut s = Particles::default(); for _ in 0..2000 { let d = [r.f(), r.f(), r.f()]; s.pos.push([d[0] * 20.0 * C::R_earth_mean, d[1] * 20.0 * C::R_earth_mean, d[2] * 20.0 * C::R_earth_mean]); s.vel.push([0.0; 3]); s.mass.push(1e21); s.mat.push(2); }
        assert!(find_objects(&s, earth_link(2000)).is_empty(), "uniform gas"); }
    fn with_moon(dist: f64) -> Vec<Object> { let n = 3000; let mut p = sample_prem_earth(n, 11, 0.0); let mut r = Rng::new(5); let k = (C::M_earth * 0.0123 / (C::M_earth / n as f64)).round() as usize; // 37
        let vorb = (C::GM_earth / dist).sqrt(); for _ in 0..k { let d = r.dir(); let a = 1.7374e6 * r.f().cbrt(); p.pos.push([dist + d[0] * a, d[1] * a, d[2] * a]); p.vel.push([0.0, vorb, 0.0]); p.mass.push(C::M_earth / n as f64); p.mat.push(2); }
        find_objects(&p, earth_link(n)) }
    #[test] fn moon_hill_and_roche() { let o = with_moon(3.844e8); assert_eq!(o.len(), 2); assert!(!o[1].trusted, "37 particles exist but are not trusted");
        let t = tidal(&o)[0]; assert!(t.inside_hill && t.outside_roche, "{t:?}"); assert!((t.hill / 6.1e7 - 1.0).abs() < 0.1, "hill {}", t.hill);
        let close = with_moon(1.2e7); let tc = tidal(&close); assert!(!tc.is_empty() && !tc[0].outside_roche, "inside Roche at 12000 km {tc:?}"); }
}
