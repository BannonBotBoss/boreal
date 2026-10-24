//! Stage 6 (T-0070): Earth formed from particles. The only primitive is the parcel: equal mass, a material class, a
//! position and a velocity. Nothing places a sphere. Density, pressure, radius, figure and surface gravity are measured
//! from the relaxed parcels.
//!
//! Methods (no code reused; GPL sources are methods only):
//! - Initial conditions: equal-mass parcels drawn from the PREM mass distribution (Dziewonski & Anderson 1981, through
//!   interior::enclosed_mass), the method of WoMa/SEAGen (Ruiz-Bonilla et al. 2021, MNRAS 500:2861; Kegerreis et al. 2019,
//!   MNRAS 487:5029) reduced to stratified radii, each draw replicated over the 48 signed axis permutations so the start
//!   has exactly zero products of inertia and A = B = C (the flattening that appears is caused by spin, not by sampling).
//! - SPH: M4 cubic spline kernel (Monaghan & Lattanzio 1985), h from a fixed neighbour count (Price 2012, JCP 231:759),
//!   symmetric pressure force (Monaghan 1992, ARAA 30:543, eq. 3.1), density per material class with the volume
//!   normalisation across interfaces (Hosono, Saitoh & Makino 2016, ApJS 224:32, sec. 2 idea) so a core-mantle jump does
//!   not leak pressure.
//! - Equation of state: barotropic, one table per class (core; mantle + crust + ocean) built from PREM's own (rho, P) pairs,
//!   made monotone with a bulk-modulus cap K <= 1.5e12 Pa (PREM's K tops out near 1.43e12 Pa at the centre); P >= 0 (no tension).
//!   Tillotson (Melosh 1989), named in the design note, has no thermal pressure at u = 0, so a cold Tillotson Earth would be
//!   too dense at depth; it is kept for impacts (open), and the barotrope is PREM's own.
//! - Gravity: direct pair sum with Plummer softening eps = h (exact for N <= ~2e4; Barnes & Hut 1986 tree is the open step
//!   for larger N).
//! - Relaxation: damped dynamics in the frame rotating at omega_earth (centrifugal term only; damping removes Coriolis
//!   oscillations), the standard way planet ICs are settled before impacts (Kegerreis 2019 sec. 2.3).
//! - Measurements: mass = sum; volume radius from the parcels' SPH volumes; J2 = (C - A)/(M a^2) from the inertia tensor,
//!   flattening from first-order Clairaut f = 3/2 J2 + q/2 (q = omega^2 a^3 / GM; Clairaut 1743, Jeffreys 1976 sec. 4.03),
//!   radii from the outer shell of parcels; surface g from the parcels' summed gravity plus the centrifugal term.
use crate::constants as C;
use crate::emergent::{Particles, Rng, V3};
use crate::interior::{enclosed_mass, prem_density, profile};

pub const NNEIGH: usize = 58;
/// h = eta (m/rho)^(1/3), eta = 1.2 (~58 neighbours for the M4 kernel; Price 2012 sec. 4).
pub const ETA: f64 = 1.2;
const KMAX: f64 = 1.5e12;

/// Material class: 0 core (PREM layers 0, 1), 1 silicate + ocean (2, 3, 4).
pub fn class_of(prem_layer: u8) -> usize { if prem_layer <= 1 || prem_layer == MAT_IRON { 0 } else { 1 } }
/// Materials of the bulk-mix start (not PREM layers): iron (class 0) and silicate (class 1).
pub const MAT_IRON: u8 = 10; pub const MAT_SILICATE: u8 = 11;

/// Cited material data (data/earth/materials.json): bulk composition and Tillotson parameters.
pub const MATERIALS_JSON: &str = include_str!("../../../data/earth/materials.json");
/// Number after `"key":` inside the object that follows `"section"` (or at top level if section is empty).
pub fn material_num(section: &str, key: &str) -> f64 { let s = if section.is_empty() { MATERIALS_JSON } else { let i = MATERIALS_JSON.find(&format!("\"{section}\"")).expect(section); &MATERIALS_JSON[i..] };
    let i = s.find(&format!("\"{key}\"")).expect(key); let r = &s[i + key.len() + 2..]; let r = r.trim_start_matches(|c: char| c == ':' || c.is_whitespace());
    let e = r.find(|c: char| !(c.is_ascii_digit() || "+-.eE".contains(c))).unwrap(); r[..e].parse().unwrap() }

/// Cold Tillotson EOS (Tillotson 1962; Melosh 1989 App. II) at zero specific energy: P = A mu + B mu^2, mu = rho/rho0 - 1,
/// no tension (P >= 0). The thermal term (a + b/(...)) rho E is zero at E = 0; it is the open step for hot interiors.
#[derive(Clone, Copy, Debug)] pub struct Tillotson { pub rho0: f64, pub a_mod: f64, pub b_mod: f64 }
impl Tillotson { pub fn from_data(name: &str) -> Tillotson { Tillotson { rho0: material_num(name, "rho0"), a_mod: material_num(name, "A"), b_mod: material_num(name, "B") } }
    pub fn pressure(&self, d: f64) -> f64 { let mu = d / self.rho0 - 1.0; (self.a_mod * mu + self.b_mod * mu * mu).max(0.0) }
    pub fn sound(&self, d: f64) -> f64 { let mu = (d / self.rho0 - 1.0).max(0.0); ((self.a_mod + 2.0 * self.b_mod * mu) / self.rho0).sqrt() } }

/// Barotropic table rho -> P for one class, from PREM (rho, P) pairs walking inward, made monotone.
pub struct Eos { rho: Vec<f64>, p: Vec<f64>, till: Option<Tillotson> }
impl Eos {
    pub fn prem(class: usize) -> Eos { let (r0, r1) = if class == 0 { (0.0, 3479.9) } else { (3480.1, 6370.9) };
        let mut rho = vec![]; let mut p = vec![]; let n = 2000;
        for k in 0..=n { let r = r1 - (r1 - r0) * k as f64 / n as f64; let pr = profile(r, 10.0); let (d, _) = prem_density(r);
            let d = d * 1000.0; let pp = pr[3];
            if let (Some(&dl), Some(&pl)) = (rho.last(), p.last()) { let dmin = dl + dl * (pp - pl) / KMAX; rho.push(f64::max(d, dmin)); } else { rho.push(d); }
            p.push(pp); }
        Eos { rho, p, till: None } }
    pub fn tillotson(t: Tillotson) -> Eos { Eos { rho: vec![], p: vec![], till: Some(t) } }
    /// Pressure at density d (Pa). Below the table: linear in rho with the end bulk modulus, clamped at 0.
    pub fn pressure(&self, d: f64) -> f64 { if let Some(t) = self.till { return t.pressure(d); } let n = self.rho.len();
        if d <= self.rho[0] { let k = (self.p[1] - self.p[0]) / (self.rho[1] - self.rho[0]); return (self.p[0] + k * (d - self.rho[0])).max(0.0); }
        if d >= self.rho[n - 1] { let k = (self.p[n - 1] - self.p[n - 2]) / (self.rho[n - 1] - self.rho[n - 2]); return self.p[n - 1] + k * (d - self.rho[n - 1]); }
        let i = self.rho.partition_point(|&x| x < d).max(1); let f = (d - self.rho[i - 1]) / (self.rho[i] - self.rho[i - 1]); self.p[i - 1] + f * (self.p[i] - self.p[i - 1]) }
    pub fn sound(&self, d: f64) -> f64 { if let Some(t) = self.till { return t.sound(d); } let e = d * 1e-3; ((self.pressure(d + e) - self.pressure(d - e)) / (2.0 * e)).max(1e4).sqrt() }
}

/// Equal-mass parcels from PREM's mass CDF, stratified in radius, 48-fold symmetric. N = 48 * nbase. At rest.
pub fn form_ic(nbase: usize, seed: u64) -> Particles { let mut r = Rng::new(seed); let mt = enclosed_mass(6371.0); let n = nbase * 48; let mut p = Particles::default();
    for i in 0..nbase { let u = (i as f64 + r.f()) / nbase as f64 * mt; let (mut lo, mut hi) = (0.0, 6371.0);
        for _ in 0..50 { let m = 0.5 * (lo + hi); if enclosed_mass(m) < u { lo = m } else { hi = m } }
        let rad = 0.5 * (lo + hi) * 1e3; let d = r.dir(); let mat = prem_density(rad / 1e3).1 as u8;
        for perm in [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] { for s in 0..8 {
            let sg = |b: usize| if s >> b & 1 == 1 { -1.0 } else { 1.0 };
            p.pos.push([sg(0) * d[perm[0]] * rad, sg(1) * d[perm[1]] * rad, sg(2) * d[perm[2]] * rad]); p.vel.push([0.0; 3]); p.mass.push(mt / n as f64); p.mat.push(mat); } } }
    p }

/// Undifferentiated start: no layer radii. Total mass M split into equal parcels; a cited bulk fraction of them is iron
/// (McDonough 2003, core 32.5 wt%), assigned at random so iron and silicate are fully mixed. Parcels fill a sphere whose
/// volume is the uncompressed volume of that mix (sum m/rho0 per material), placed near-uniformly the SEAGen way
/// (Kegerreis et al. 2019, MNRAS 487:5029: concentric shells one inter-particle spacing thick, each with ~uniform points,
/// randomly rotated) - method only, using golden-spiral points per shell (Gonzalez 2010, Math. Geosci. 42:49) in place
/// of SEAGen's equal-area regions. Returns (parcels, uniform start density).
pub fn form_mix_ic(n_target: usize, seed: u64) -> (Particles, f64) { let mut r = Rng::new(seed); let m_tot = C::M_earth; let fe = material_num("", "bulk_core_mass_fraction");
    let rho_mix = 1.0 / (fe / material_num("iron", "rho0") + (1.0 - fe) / material_num("basalt", "rho0"));
    let r_out = (3.0 * m_tot / (4.0 * std::f64::consts::PI * rho_mix)).cbrt(); let dr = r_out * (4.0 * std::f64::consts::PI / 3.0 / n_target as f64).cbrt();
    let nsh = (r_out / dr).round() as usize; let dr = r_out / nsh as f64; let mut pos: Vec<V3> = vec![];
    for k in 0..nsh { let rad = (k as f64 + 0.5) * dr; let nk = ((4.0 * std::f64::consts::PI * rad * rad * dr) / (dr * dr * dr)).round().max(1.0) as usize;
        let (ax, ang) = (r.dir(), r.f() * std::f64::consts::TAU); let (c, s) = (ang.cos(), ang.sin()); let ga = std::f64::consts::PI * (3.0 - 5f64.sqrt());
        for j in 0..nk { let z = 1.0 - (2.0 * j as f64 + 1.0) / nk as f64; let rr = (1.0 - z * z).sqrt(); let t = ga * j as f64; let v = [rr * t.cos(), rr * t.sin(), z];
            // Rodrigues rotation of v about ax by ang (random per shell)
            let d = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2]; let x = [ax[1] * v[2] - ax[2] * v[1], ax[2] * v[0] - ax[0] * v[2], ax[0] * v[1] - ax[1] * v[0]];
            pos.push([rad * (v[0] * c + x[0] * s + ax[0] * d * (1.0 - c)), rad * (v[1] * c + x[1] * s + ax[1] * d * (1.0 - c)), rad * (v[2] * c + x[2] * s + ax[2] * d * (1.0 - c))]); } }
    let n = pos.len(); let n_fe = (fe * n as f64).round() as usize; let mut mat: Vec<u8> = (0..n).map(|i| if i < n_fe { MAT_IRON } else { MAT_SILICATE }).collect();
    for i in (1..n).rev() { let j = (r.f() * (i + 1) as f64) as usize % (i + 1); mat.swap(i, j); }
    let mut p = Particles::default(); for i in 0..n { p.pos.push(pos[i]); p.vel.push([0.0; 3]); p.mass.push(m_tot / n as f64); p.mat.push(mat[i]); } (p, rho_mix) }

fn w(r: f64, h: f64) -> f64 { let q = r / h; let s = 1.0 / (std::f64::consts::PI * h * h * h); if q < 1.0 { s * (1.0 - 1.5 * q * q + 0.75 * q * q * q) } else if q < 2.0 { s * 0.25 * (2.0 - q).powi(3) } else { 0.0 } }
fn dw(r: f64, h: f64) -> f64 { let q = r / h; let s = 1.0 / (std::f64::consts::PI * h.powi(4)); if q < 1.0 { s * (-3.0 * q + 2.25 * q * q) } else if q < 2.0 { -s * 0.75 * (2.0 - q).powi(2) } else { 0.0 } }
fn d2(a: V3, b: V3) -> f64 { (a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2) }

/// Neighbours within 2 max(h_i, h_j) via a uniform grid (h_j bounded by the cell search radius).
fn neighbours(pos: &[V3], h: &[f64]) -> Vec<Vec<usize>> { let n = pos.len(); let hmax = h.iter().cloned().fold(0.0, f64::max).max(1.0);
    let cell = 2.0 * hmax; let key = |x: V3| [(x[0] / cell).floor() as i64, (x[1] / cell).floor() as i64, (x[2] / cell).floor() as i64];
    let mut grid: std::collections::HashMap<[i64; 3], Vec<usize>> = Default::default(); for (i, &x) in pos.iter().enumerate() { grid.entry(key(x)).or_default().push(i); }
    par_map(n, |i| { let k = key(pos[i]); let mut c = vec![]; for a in -1..=1 { for b in -1..=1 { for e in -1..=1 { if let Some(v) = grid.get(&[k[0] + a, k[1] + b, k[2] + e]) {
        for &j in v { let s = 2.0 * h[i].max(h[j]); if d2(pos[i], pos[j]) < s * s { c.push(j); } } } } } } c }) }

fn par_map<T: Send, F: Fn(usize) -> T + Sync>(n: usize, f: F) -> Vec<T> { let th = std::thread::available_parallelism().map(|x| x.get()).unwrap_or(1).min(16); let chunk = n.div_ceil(th).max(1); if th == 1 { return (0..n).map(f).collect(); } // wasm32: no threads
    let mut out: Vec<Vec<T>> = vec![]; std::thread::scope(|s| { let hs: Vec<_> = (0..th).map(|t| { let f = &f; s.spawn(move || ((t * chunk)..((t + 1) * chunk).min(n)).map(f).collect::<Vec<T>>()) }).collect();
        for h in hs { out.push(h.join().unwrap()); } }); out.into_iter().flatten().collect() }


/// Barnes & Hut (1986, Nature 324:446) octree, monopole cells, opening angle theta; written from the paper.
struct Node { c: V3, half: f64, m: f64, com: V3, kids: [u32; 8], leaf: i64 }
pub struct Tree { n: Vec<Node> }
impl Tree {
    pub fn build(pos: &[V3], mass: &[f64]) -> Tree { let mut lo = [f64::MAX; 3]; let mut hi = [f64::MIN; 3]; for x in pos { for k in 0..3 { lo[k] = lo[k].min(x[k]); hi[k] = hi[k].max(x[k]); } }
        let c = [(lo[0] + hi[0]) / 2.0, (lo[1] + hi[1]) / 2.0, (lo[2] + hi[2]) / 2.0]; let half = (0..3).map(|k| hi[k] - lo[k]).fold(0.0, f64::max) / 2.0 * 1.001 + 1.0;
        let mut t = Tree { n: vec![] }; let idx: Vec<usize> = (0..pos.len()).collect(); t.add(pos, mass, idx, c, half, 0); t }
    fn add(&mut self, pos: &[V3], mass: &[f64], idx: Vec<usize>, c: V3, half: f64, depth: u32) -> u32 { let me = self.n.len() as u32;
        let m: f64 = idx.iter().map(|&i| mass[i]).sum(); let mut com = [0.0; 3]; for &i in &idx { for k in 0..3 { com[k] += mass[i] * pos[i][k] / m; } }
        self.n.push(Node { c, half, m, com, kids: [u32::MAX; 8], leaf: if idx.len() == 1 || depth > 40 { idx[0] as i64 } else { -1 } });
        if idx.len() == 1 || depth > 40 { return me; }
        let mut parts: [Vec<usize>; 8] = Default::default(); for &i in &idx { let o = (pos[i][0] > c[0]) as usize | ((pos[i][1] > c[1]) as usize) << 1 | ((pos[i][2] > c[2]) as usize) << 2; parts[o].push(i); }
        for (o, v) in parts.into_iter().enumerate() { if v.is_empty() { continue; } let h = half / 2.0;
            let cc = [c[0] + if o & 1 > 0 { h } else { -h }, c[1] + if o & 2 > 0 { h } else { -h }, c[2] + if o & 4 > 0 { h } else { -h }];
            let k = self.add(pos, mass, v, cc, h, depth + 1); self.n[me as usize].kids[o] = k; } me }
    /// Acceleration at x (excluding particle `skip`), Plummer softening eps.
    pub fn accel(&self, x: V3, skip: usize, eps: f64, theta: f64) -> V3 { let mut a = [0.0; 3]; let mut st = vec![0u32];
        while let Some(k) = st.pop() { let nd = &self.n[k as usize]; if nd.leaf == skip as i64 { continue; }
            let d = [x[0] - nd.com[0], x[1] - nd.com[1], x[2] - nd.com[2]]; let r2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
            if nd.leaf >= 0 || (2.0 * nd.half).powi(2) < theta * theta * r2 { let f = -C::G * nd.m / (r2 + eps * eps).powf(1.5); for q in 0..3 { a[q] += f * d[q]; } }
            else { for &c in &nd.kids { if c != u32::MAX { st.push(c); } } } } a }
}

pub struct State { pub p: Particles, pub h: Vec<f64>, pub rho: Vec<f64>, pub pres: Vec<f64>, nb: Vec<Vec<usize>>, eos: [Eos; 2], pub omega: f64 }
impl State {
    pub fn new(p: Particles, omega: f64) -> State { let n = p.pos.len(); let h0 = 6.371e6 * (NNEIGH as f64 / n as f64).cbrt() * 0.5;
        let rho = (0..n).map(|i| prem_density(norm(p.pos[i]) / 1e3).0 * 1e3).collect();
        let mut s = State { p, h: vec![h0; n], rho, pres: vec![0.0; n], nb: vec![], eos: [Eos::prem(0), Eos::prem(1)], omega }; s.density(); s }
    /// Bulk-mix start: the given parcels (materials already assigned), uniform starting density rho0, Tillotson iron/silicate.
    pub fn from_mix(p: Particles, omega: f64, rho0: f64) -> State { let n = p.pos.len();
        let mut s = State { p, h: vec![0.0; n], rho: vec![rho0; n], pres: vec![0.0; n], nb: vec![], eos: [Eos::tillotson(Tillotson::from_data("iron")), Eos::tillotson(Tillotson::from_data("basalt"))], omega }; s.density(); s }
    /// SPH density: the standard summation rho_i = sum_j m_j W(r_ij, h_i), self term included, with h_i = eta (m_i/rho_i)^(1/3)
    /// iterated to consistency (Price 2012, JCP 231:759, sec. 2.4 / eqs. 10-11). Stage 6 first shipped a Shepard-normalised
    /// form rho_i = sum m_j W / sum (m_j/rho_j) W; any uniform field is a fixed point of that, so it only smoothed the old
    /// density and never responded to compression (the cause of the too-dense core, see notes/design/emergent-bodies.md).
    pub fn density(&mut self) { let n = self.p.pos.len(); let mut nb = vec![];
        for _ in 0..3 { self.h = (0..n).map(|i| ETA * (self.p.mass[i] / self.rho[i]).cbrt()).collect(); nb = neighbours(&self.p.pos, &self.h);
            let p = &self.p; let hh = &self.h; let nbr = &nb;
            self.rho = par_map(n, |i| nbr[i].iter().map(|&j| p.mass[j] * w(d2(p.pos[i], p.pos[j]).sqrt(), hh[i])).sum::<f64>().max(1.0)); }
        self.pres = (0..n).map(|i| self.eos[class_of(self.p.mat[i])].pressure(self.rho[i])).collect(); self.nb = nb; }
    /// Accelerations: SPH pressure (symmetric, mean of both h), softened self-gravity (direct sum), centrifugal.
    pub fn accel(&self) -> Vec<V3> { let p = &self.p; let n = p.pos.len(); let g = C::G;
        let tree = Tree::build(&p.pos, &p.mass);
        par_map(n, |i| { let xi = p.pos[i]; let mut a = tree.accel(xi, i, self.h[i], 0.6); let _ = g;
            for &j in &self.nb[i] { if j == i { continue; } let dx = [xi[0] - p.pos[j][0], xi[1] - p.pos[j][1], xi[2] - p.pos[j][2]]; let r = norm(dx); if r == 0.0 { continue; }
                let gw = 0.5 * (dw(r, self.h[i]) + dw(r, self.h[j])); let f = -p.mass[j] * (self.pres[i] / self.rho[i].powi(2) + self.pres[j] / self.rho[j].powi(2)) * gw / r;
                for k in 0..3 { a[k] += f * dx[k]; } }
            let w2 = self.omega * self.omega; a[0] += w2 * xi[0]; a[1] += w2 * xi[1]; a }) }
    /// One damped step (kick-drift, velocity damping fraction `damp`); dt from the sound-crossing CFL (0.25 h / c).
    pub fn step(&mut self, damp: f64) -> f64 { let n = self.p.pos.len();
        let dt = (0..n).map(|i| 0.25 * self.h[i] / self.eos[class_of(self.p.mat[i])].sound(self.rho[i])).fold(f64::INFINITY, f64::min);
        let a = self.accel(); for i in 0..n { for k in 0..3 { self.p.vel[i][k] = (self.p.vel[i][k] + a[i][k] * dt) * (1.0 - damp); self.p.pos[i][k] += self.p.vel[i][k] * dt; } }
        self.density(); dt }
    pub fn relax(&mut self, steps: usize, damp: f64) -> f64 { let mut t = 0.0; for _ in 0..steps { t += self.step(damp); } t }
}
pub fn norm(a: V3) -> f64 { (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt() }

/// Measurements of a relaxed body against real Earth.
#[derive(Debug, Clone, Copy)] pub struct Figure { pub n: usize, pub mass: f64, pub com: f64, pub r_vol: f64, pub a: f64, pub c: f64, pub j2: f64, pub f_clairaut: f64, pub f_shape: f64, pub moi: f64, pub g_eq: f64, pub g_pole: f64, pub rho_centre: f64, pub vmax: f64 }
pub fn measure(s: &State) -> Figure { let p = &s.p; let n = p.pos.len(); let m: f64 = p.mass.iter().sum();
    let mut com = [0.0; 3]; for i in 0..n { for k in 0..3 { com[k] += p.mass[i] * p.pos[i][k] / m; } }
    let x: Vec<V3> = p.pos.iter().map(|q| [q[0] - com[0], q[1] - com[1], q[2] - com[2]]).collect();
    let vol: f64 = (0..n).map(|i| p.mass[i] / s.rho[i]).sum(); let r_vol = (3.0 * vol / (4.0 * std::f64::consts::PI)).cbrt();
    let (mut ia, mut ic) = (0.0, 0.0); for i in 0..n { ia += 0.5 * p.mass[i] * (x[i][0].powi(2) + x[i][1].powi(2) + 2.0 * x[i][2].powi(2)); ic += p.mass[i] * (x[i][0].powi(2) + x[i][1].powi(2)); }
    // figure: J2 from the inertia tensor (MacCullagh), flattening from first-order Clairaut f = 3/2 J2 + q/2, a and c from
    // the volume radius (a^2 c = R_vol^3). The outer-shell spheroid fit (f_shape) is kept as a cross-check; at 48k parcels
    // the shell is ~100 km thick against a 21 km equator-pole difference, so it is noisy.
    let mut idx: Vec<usize> = (0..n).collect(); idx.sort_by(|&i, &j| norm(x[j]).partial_cmp(&norm(x[i])).unwrap()); let sh = &idx[..n / 10];
    let (mut s1, mut s2, mut s11, mut s12) = (0.0, 0.0, 0.0, 0.0); let k = sh.len() as f64; for &i in sh { let r = norm(x[i]); let s2p = (x[i][2] / r).powi(2); s1 += s2p; s2 += r; s11 += s2p * s2p; s12 += s2p * r; }
    let slope = (k * s12 - s1 * s2) / (k * s11 - s1 * s1); let icpt = (s2 - slope * s1) / k; let f_shape = -slope / icpt;
    let (mut a, mut j2, mut q, mut f) = (r_vol, 0.0, 0.0, 0.0);
    for _ in 0..4 { j2 = (ic - ia) / (m * a * a); q = s.omega.powi(2) * a.powi(3) / (C::G * m); f = 1.5 * j2 + 0.5 * q; a = r_vol / (1.0 - f).cbrt(); }
    let c = a * (1.0 - f);
    // surface g from the parcels' exterior field: monopole + J2 (MacCullagh: J2 = (C - A)/(M a^2) is the field's degree-2
    // term), plus the centrifugal term, evaluated on the measured figure (Heiskanen & Moritz 1967 sec. 2-9, first order in J2)
    let gm = C::G * m; let g_eq = gm / (a * a) * (1.0 + 1.5 * j2) - s.omega.powi(2) * a; let g_pole = gm / (c * c) * (1.0 - 3.0 * j2 * (a / c).powi(2));
    let core: Vec<usize> = (0..n).filter(|&i| norm(x[i]) < 1.0e6).collect(); let rho_c = if core.is_empty() { 0.0 } else { core.iter().map(|&i| s.rho[i]).sum::<f64>() / core.len() as f64 };
    Figure { n, mass: m, com: norm(com), r_vol, a, c, j2, f_clairaut: f, f_shape, moi: ic / (m * r_vol * r_vol), g_eq, g_pole, rho_centre: rho_c, vmax: p.vel.iter().map(|&v| norm(v)).fold(0.0, f64::max) } }

/// Radial profile about the centre of mass: (shell mid-radius m, shell density = parcel mass / shell volume, mean SPH
/// density in the shell, parcel count). The shell density is the truth the SPH estimate is checked against.
pub fn radial_profile(s: &State, rmax: f64, bins: usize) -> Vec<(f64, f64, f64, usize)> { let p = &s.p; let n = p.pos.len(); let m: f64 = p.mass.iter().sum();
    let mut com = [0.0; 3]; for i in 0..n { for k in 0..3 { com[k] += p.mass[i] * p.pos[i][k] / m; } }
    let (mut ms, mut rs, mut ns) = (vec![0.0; bins], vec![0.0; bins], vec![0usize; bins]);
    for i in 0..n { let r = norm([p.pos[i][0] - com[0], p.pos[i][1] - com[1], p.pos[i][2] - com[2]]); let b = (r / rmax * bins as f64) as usize; if b < bins { ms[b] += p.mass[i]; rs[b] += s.rho[i]; ns[b] += 1; } }
    (0..bins).map(|b| { let (r0, r1) = (rmax * b as f64 / bins as f64, rmax * (b + 1) as f64 / bins as f64); let v = 4.0 / 3.0 * std::f64::consts::PI * (r1.powi(3) - r0.powi(3));
        (0.5 * (r0 + r1), ms[b] / v, if ns[b] > 0 { rs[b] / ns[b] as f64 } else { 0.0 }, ns[b]) }).collect() }

/// Emergent boundary measures from the parcels (no layer radii given): `separation` = fraction of the n_iron innermost
/// parcels that are iron (1 = fully differentiated, ~0.325 = fully mixed); `cmb` = radius of the n_iron-th parcel from the
/// centre of mass, i.e. where the core would end if it were exactly the iron parcels.
pub struct Boundaries { pub separation: f64, pub cmb: f64 }
pub fn boundaries(s: &State) -> Boundaries { let p = &s.p; let n = p.pos.len(); let m: f64 = p.mass.iter().sum();
    let mut com = [0.0; 3]; for i in 0..n { for k in 0..3 { com[k] += p.mass[i] * p.pos[i][k] / m; } }
    let mut idx: Vec<(f64, bool)> = (0..n).map(|i| (norm([p.pos[i][0] - com[0], p.pos[i][1] - com[1], p.pos[i][2] - com[2]]), class_of(p.mat[i]) == 0)).collect();
    idx.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap()); let nfe = idx.iter().filter(|x| x.1).count().max(1);
    Boundaries { separation: idx[..nfe].iter().filter(|x| x.1).count() as f64 / nfe as f64, cmb: 0.5 * (idx[nfe - 1].0 + idx[nfe.min(n - 1)].0) } }

/// Bake: x, y, z (f32, metres from the centre of mass), material (f32), SPH density (f32), h (f32) per parcel.
pub fn bake(s: &State) -> Vec<f32> { let f = measure(s); let _ = f; let p = &s.p; let n = p.pos.len(); let m: f64 = p.mass.iter().sum();
    let mut com = [0.0; 3]; for i in 0..n { for k in 0..3 { com[k] += p.mass[i] * p.pos[i][k] / m; } }
    let mut o = Vec::with_capacity(n * 6); for i in 0..n { for k in 0..3 { o.push((p.pos[i][k] - com[k]) as f32); } o.push(p.mat[i] as f32); o.push(s.rho[i] as f32); o.push(s.h[i] as f32); } o }

/// Rebuild a State from a bake (equal masses M_PREM / n) to re-measure it.
pub fn from_bake(b: &[f32], omega: f64) -> State { let n = b.len() / 6; let mt = enclosed_mass(6371.0); let mut p = Particles::default();
    for i in 0..n { let o = &b[i * 6..i * 6 + 6]; p.pos.push([o[0] as f64, o[1] as f64, o[2] as f64]); p.vel.push([0.0; 3]); p.mass.push(mt / n as f64); p.mat.push(o[3] as u8); }
    State { h: (0..n).map(|i| b[i * 6 + 5] as f64).collect(), rho: (0..n).map(|i| b[i * 6 + 4] as f64).collect(), pres: vec![0.0; n], nb: vec![], eos: if b.chunks(6).any(|o| o[3] as u8 >= MAT_IRON) { [Eos::tillotson(Tillotson::from_data("iron")), Eos::tillotson(Tillotson::from_data("basalt"))] } else { [Eos::prem(0), Eos::prem(1)] }, omega, p } }

#[cfg(test)]
mod tests { use super::*;
    #[test] fn eos_reproduces_prem_pressure() { let e = Eos::prem(1); let (d, _) = prem_density(5000.0); let p = profile(5000.0, 10.0)[3]; assert!((e.pressure(d * 1e3) / p - 1.0).abs() < 0.02);
        let e0 = Eos::prem(0); let (d, _) = prem_density(2000.0); let p = profile(2000.0, 10.0)[3]; assert!((e0.pressure(d * 1e3) / p - 1.0).abs() < 0.02); }
    #[test] fn ic_is_symmetric_and_has_earth_mass() { let p = form_ic(10, 3); assert_eq!(p.pos.len(), 480); let m: f64 = p.mass.iter().sum(); assert!((m / C::M_earth - 1.0).abs() < 0.005, "mass {m:e}");
        let (mut xy, mut xx, mut zz) = (0.0, 0.0, 0.0); for x in &p.pos { xy += x[0] * x[1]; xx += x[0] * x[0]; zz += x[2] * x[2]; } assert!(xy.abs() < 1e-6 * xx && (xx / zz - 1.0).abs() < 1e-12); }
    /// The committed bake (public/bake/earth-parcels.bin, 48k parcels) measured against real Earth (WGS84 / IERS 2010 / PREM).
    #[test] fn baked_earth_matches_measurements() { let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../public/bake/earth-parcels.bin");
        let bytes = std::fs::read(path).expect("bake"); let b: Vec<f32> = bytes.chunks(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect();
        let f = measure(&from_bake(&b, C::omega_earth));
        assert!((f.mass / 5.9722e24 - 1.0).abs() < 0.002, "mass {:e}", f.mass); assert!(f.com < 1e3, "com {}", f.com);
        assert!((f.r_vol / C::R_earth_mean - 1.0).abs() < 0.02, "R_vol {}", f.r_vol);
        assert!((1.0 / f.f_clairaut / 298.257 - 1.0).abs() < 0.25, "1/f {}", 1.0 / f.f_clairaut);
        assert!((f.g_eq / 9.7803 - 1.0).abs() < 0.04 && (f.g_pole / 9.8322 - 1.0).abs() < 0.04 && f.g_pole > f.g_eq, "g {} {}", f.g_eq, f.g_pole); }
    #[test] fn spinning_parcels_flatten() { // small run: 960 parcels, spin on; the figure must flatten toward the pole and stay one bound body
        let mut s = State::new(form_ic(20, 5), C::omega_earth); s.relax(150, 0.05); let f = measure(&s);
        assert!((f.mass / C::M_earth - 1.0).abs() < 0.005); assert!(f.com < 1.0, "com {}", f.com); assert!(f.j2 > 0.0 && f.f_clairaut > 0.0, "{f:?}");
        let objs = crate::emergent::find_objects(&s.p, crate::emergent::earth_link(s.p.pos.len())); assert_eq!(objs.len(), 1); }
    #[test] fn tillotson_from_cited_data() { let fe = Tillotson::from_data("iron"); assert_eq!(fe.rho0, 7800.0); assert_eq!(fe.pressure(7800.0), 0.0); assert_eq!(fe.pressure(7000.0), 0.0);
        assert!((fe.pressure(7800.0 * 1.1) - (1.28e11 * 0.1 + 1.05e11 * 0.01)).abs() < 1e3); assert_eq!(material_num("", "bulk_core_mass_fraction"), 0.325); }
    #[test] fn mix_start_is_undifferentiated() { let (p, rho) = form_mix_ic(3000, 7); let n = p.pos.len(); assert!((n as f64 / 3000.0 - 1.0).abs() < 0.1, "n {n}");
        let m: f64 = p.mass.iter().sum(); assert!((m / C::M_earth - 1.0).abs() < 1e-9); assert!(rho > 2700.0 && rho < 7800.0);
        let s = State::from_mix(p, C::omega_earth, rho); let b = boundaries(&s); assert!((b.separation - 0.325).abs() < 0.06, "sep {}", b.separation); }
    #[test] fn iron_sinks_from_the_mix() { // gravity alone (no layer radii) must start moving iron inward
        let (p, rho) = form_mix_ic(2000, 7); let mut s = State::from_mix(p, C::omega_earth, rho); let b0 = boundaries(&s).separation; s.relax(400, 0.05);
        let b1 = boundaries(&s).separation; assert!(b1 > b0 + 0.08, "separation {b0} -> {b1}"); }
}
