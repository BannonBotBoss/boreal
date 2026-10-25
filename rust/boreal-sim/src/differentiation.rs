//! Hot differentiation (T-0070 core pass 2). A bulk iron + silicate mix with per-parcel specific internal energy u settles
//! under gravity and spin; every boundary is read off the result, none is given.
//!
//! Methods (reimplemented from the papers; no GPL code):
//! - Tillotson EOS, full form (Tillotson 1962; Melosh 1989 App. II): compressed P1 = (a + b/(u/(E0 eta^2)+1)) rho u + A mu + B mu^2,
//!   expanded hot P3 with the alpha/beta exponentials, linear blend between E_IV and E_CV; cold expanded states use P1 with
//!   B = 0 (Brundage 2013). No tension (P >= 0). Parameters: data/earth/materials.json (iron: Melosh 1989; mantle: dunite,
//!   Marinova et al. 2011).
//! - Temperature: T = (u - E_c(rho)) / c_v with the cold curve dE_c/drho = P1(rho, E_c)/rho^2, E_c(rho0) = 0 (the pyKO /
//!   Brundage 2013 construction).
//! - Density: SPH summation with h iterated (Price 2012), then the Ruiz-Bonilla et al. 2022 (MNRAS 512:4660) correction:
//!   imbalance statistic I (eq. 12, alpha set so a half-filled regular grid gives I = 1.5), e^{-I^2}-weighted neighbour
//!   P and T (eq. 13-14), rho = rho_EoS(T~, P~) (eq. 15), P = P_EoS(rho~, u).
//! - Forces: geometric-density-average force (GDF, Wadsley, Keller & Quinn 2017, MNRAS 471:2357; RB22 eqs. 5-6) with the
//!   mean of both kernel gradients (the f_i correction of eq. 9 is omitted: open).
//! - Energy: du/dt from GDF eq. 6; the velocity damping used for settling turns the removed kinetic energy into u, so the
//!   gravitational energy released by iron sinking heats the planet (energy-conserving damping).
//! - Inner core: iron parcels with T below the iron melting curve at their pressure (Anzellini et al. 2013, Science 340:464)
//!   are tagged solid (MAT_IRON_SOLID). Phase density change and latent heat are open.
#[cfg(test)] use crate::constants as C;
use crate::emergent::{Particles, V3};
use crate::formation::{self as F, material_num, norm, Figure, Tree, MAT_IRON, MAT_IRON_SOLID};

#[derive(Clone, Debug)]
pub struct Till { pub rho0: f64, pub a_mod: f64, pub b_mod: f64, pub e0: f64, pub eiv: f64, pub ecv: f64, pub a: f64, pub b: f64, pub alpha: f64, pub beta: f64, pub cv: f64, cold: Vec<f64> }
const COLD_LO: f64 = 0.3; const COLD_HI: f64 = 8.0; const COLD_N: usize = 7700; // deta = 0.001 so eta = 1 is a grid node
impl Till {
    pub fn from_data(name: &str) -> Till { let g = |k: &str| material_num(name, k);
        let mut t = Till { rho0: g("rho0"), a_mod: g("A"), b_mod: g("B"), e0: g("E0"), eiv: g("EIV"), ecv: g("ECV"), a: g("a"), b: g("b"), alpha: g("alpha"), beta: g("beta"), cv: g("cv"), cold: vec![] };
        // cold curve E_c(rho) on eta in [COLD_LO, COLD_HI], RK4 both ways from eta = 1
        let n = COLD_N; let deta = (COLD_HI - COLD_LO) / n as f64; let i0 = ((1.0 - COLD_LO) / deta).round() as usize; let mut e = vec![0.0; n + 1];
        let f = |t: &Till, eta: f64, ec: f64| t.p1(eta * t.rho0, ec) / (eta * eta * t.rho0); // dE/deta = P/(rho^2) * rho0
        for dir in [1i64, -1] { let mut k = i0 as i64; while (dir > 0 && k < n as i64) || (dir < 0 && k > 0) { let eta = COLD_LO + k as f64 * deta; let h = dir as f64 * deta; let y = e[k as usize];
            let k1 = f(&t, eta, y); let k2 = f(&t, eta + h / 2.0, y + h / 2.0 * k1); let k3 = f(&t, eta + h / 2.0, y + h / 2.0 * k2); let k4 = f(&t, eta + h, y + h * k3);
            e[(k + dir) as usize] = y + h / 6.0 * (k1 + 2.0 * k2 + 2.0 * k3 + k4); k += dir; } }
        t.cold = e; t }
    fn p1(&self, rho: f64, u: f64) -> f64 { let eta = rho / self.rho0; let mu = eta - 1.0; let bm = if mu < 0.0 { 0.0 } else { self.b_mod };
        (self.a + self.b / (u / (self.e0 * eta * eta) + 1.0)) * rho * u + self.a_mod * mu + bm * mu * mu }
    fn p3(&self, rho: f64, u: f64) -> f64 { let eta = rho / self.rho0; let mu = eta - 1.0; let x = 1.0 / eta - 1.0;
        self.a * rho * u + (self.b * rho * u / (u / (self.e0 * eta * eta) + 1.0) + self.a_mod * mu * (-self.beta * x).exp()) * (-self.alpha * x * x).exp() }
    /// Pressure (Pa) at density rho (kg/m3) and specific internal energy u (J/kg); no tension.
    pub fn pressure(&self, rho: f64, u: f64) -> f64 { let u = u.max(0.0);
        let p = if rho >= self.rho0 || u <= self.eiv { self.p1(rho, u) } else if u >= self.ecv { self.p3(rho, u) } else { ((u - self.eiv) * self.p3(rho, u) + (self.ecv - u) * self.p1(rho, u)) / (self.ecv - self.eiv) };
        p.max(0.0) }
    /// Sound speed from c^2 = dP/drho|_u + P/rho^2 dP/du (numerical), floored at 10 % of the zero-pressure value.
    pub fn sound(&self, rho: f64, u: f64) -> f64 { let (dr, du) = (rho * 1e-4, u.abs().max(1e3) * 1e-3); let p = self.pressure(rho, u);
        let c2 = (self.pressure(rho + dr, u) - self.pressure(rho - dr, u)) / (2.0 * dr) + p / (rho * rho) * (self.pressure(rho, u + du) - self.pressure(rho, (u - du).max(0.0))) / (2.0 * du);
        c2.max(0.01 * self.a_mod / self.rho0).sqrt() }
    pub fn e_cold(&self, rho: f64) -> f64 { let x = ((rho / self.rho0 - COLD_LO) / (COLD_HI - COLD_LO) * COLD_N as f64).clamp(0.0, COLD_N as f64 - 1e-9); let i = x as usize; let f = x - i as f64; self.cold[i] * (1.0 - f) + self.cold[i + 1] * f }
    pub fn temperature(&self, rho: f64, u: f64) -> f64 { ((u - self.e_cold(rho)) / self.cv).max(0.0) }
    /// Density at temperature T and pressure P (bisection on rho; P rises with rho along an isotherm here).
    pub fn rho_at(&self, t: f64, p: f64) -> f64 { let (mut lo, mut hi) = (COLD_LO * self.rho0, COLD_HI * self.rho0);
        if self.pressure(lo, self.e_cold(lo) + self.cv * t) >= p { return lo; }
        for _ in 0..60 { let m = 0.5 * (lo + hi); if self.pressure(m, self.e_cold(m) + self.cv * t) < p { lo = m } else { hi = m } } 0.5 * (lo + hi) }
}

/// Iron melting temperature at pressure P (Anzellini et al. 2013 Simon-Glatzel fit; constants in materials.json).
pub fn iron_melting_t(p: f64) -> f64 { let g = |k: &str| material_num("iron_melting", k); let (t0, p0, a, c) = (g("T0_K"), g("P0_Pa"), g("a_Pa"), g("c"));
    t0 * ((p - p0).max(0.0) / a + 1.0).powf(1.0 / c) }

/// Core alloy liquidus: the pure-iron curve lowered by the light-element freezing-point depression (Alfe, Gillan & Price 2002;
/// constant in materials.json). Pure iron froze the whole CMB solid because its ~4100 K melting point there sits above the core-top T.
pub fn core_liquidus_t(p: f64) -> f64 { iron_melting_t(p) - material_num("core_light_elements", "melting_depression_K") }

/// RB22 alpha: I/alpha for a regular cubic grid (spacing 1, h = eta) filling the half-space z <= 0, then alpha = 1.5 / that.
pub fn rb22_alpha() -> f64 { let h = F::ETA; let k = (2.0 * h).ceil() as i64; let (mut num, mut den) = ([0.0; 3], 0.0);
    for x in -k..=k { for y in -k..=k { for z in -k..=0 { let r = [x as f64, y as f64, z as f64]; let wv = F::w(norm(r), h); for q in 0..3 { num[q] += r[q] * wv; } den += wv; } } }
    1.5 / (norm(num) / (h * den)) }

pub struct Hot { pub p: Particles, pub h: Vec<f64>, pub rho: Vec<f64>, pub u: Vec<f64>, pub pres: Vec<f64>, pub temp: Vec<f64>, pub imb: Vec<f64>, nb: Vec<Vec<usize>>, pub mats: [Till; 2], pub omega: f64, alpha: f64, pub heat_from_damping: f64, pub heat_removed: f64 }
impl Hot {
    /// Bulk-mix start with the named silicate, uniform start density, every parcel at the cited initial temperature.
    pub fn mix(n_target: usize, seed: u64, silicate: &str, omega: f64) -> Hot { let (p, rho0) = F::form_mix_ic_with(n_target, seed, silicate); let n = p.pos.len();
        let mats = [Till::from_data("iron"), Till::from_data(silicate)]; let t0 = material_num("", "initial_temperature_K");
        let u = (0..n).map(|i| { let m = &mats[F::class_of(p.mat[i])]; m.e_cold(rho0) .max(0.0) + m.cv * t0 }).collect();
        let mut s = Hot { p, h: vec![0.0; n], rho: vec![rho0; n], u, pres: vec![0.0; n], temp: vec![0.0; n], imb: vec![0.0; n], nb: vec![], mats, omega, alpha: rb22_alpha(), heat_from_damping: 0.0, heat_removed: 0.0 }; s.density(); s }
    fn mat(&self, i: usize) -> &Till { &self.mats[F::class_of(self.p.mat[i])] }
    pub fn density(&mut self) { let n = self.p.pos.len(); let mut nb = vec![];
        for _ in 0..3 { self.h = (0..n).map(|i| F::ETA * (self.p.mass[i] / self.rho[i]).cbrt()).collect(); nb = F::neighbours(&self.p.pos, &self.h);
            let p = &self.p; let hh = &self.h; let nbr = &nb;
            self.rho = F::par_map(n, |i| nbr[i].iter().map(|&j| p.mass[j] * F::w(F::d2(p.pos[i], p.pos[j]).sqrt(), hh[i])).sum::<f64>().max(1.0)); }
        // RB22: standard P, T and the imbalance statistic, then the corrected density
        let p = &self.p; let hh = &self.h; let nbr = &nb; let al = self.alpha;
        let pt: Vec<(f64, f64)> = (0..n).map(|i| { let m = self.mat(i); (m.pressure(self.rho[i], self.u[i]), m.temperature(self.rho[i], self.u[i])) }).collect();
        let imb: Vec<f64> = F::par_map(n, |i| { let ci = F::class_of(p.mat[i]); let (mut v, mut den) = ([0.0; 3], 0.0);
            for &j in &nbr[i] { let wv = F::w(F::d2(p.pos[i], p.pos[j]).sqrt(), hh[i]); if wv == 0.0 { continue; } let k = if F::class_of(p.mat[j]) == ci { 1.0 } else { -1.0 };
                for q in 0..3 { v[q] += k * (p.pos[j][q] - p.pos[i][q]) * p.mass[j] * wv; } den += p.mass[j] * wv; }
            al * norm(v) / (hh[i] * den) });
        let (mats, u) = (&self.mats, &self.u); let imbr = &imb; let ptr = &pt;
        let out: Vec<(f64, f64, f64)> = F::par_map(n, |i| { let (mut sp, mut st, mut sw) = (0.0, 0.0, 0.0);
            for &j in &nbr[i] { let wv = F::w(F::d2(p.pos[i], p.pos[j]).sqrt(), hh[i]) * (-imbr[j] * imbr[j]).exp(); sp += ptr[j].0 * wv; st += ptr[j].1 * wv; sw += wv; }
            let e = (-imbr[i] * imbr[i]).exp(); let (pb, tb) = if sw > 0.0 { (sp / sw, st / sw) } else { ptr[i] };
            let (pt_, tt) = (e * ptr[i].0 + (1.0 - e) * pb, e * ptr[i].1 + (1.0 - e) * tb); let m = &mats[F::class_of(p.mat[i])];
            let r = if e > 0.999 { self.rho[i] } else { m.rho_at(tt, pt_) }; (r, m.pressure(r, u[i]), m.temperature(r, u[i])) });
        self.rho = out.iter().map(|x| x.0).collect(); self.pres = out.iter().map(|x| x.1).collect(); self.temp = out.iter().map(|x| x.2).collect(); self.imb = imb; self.nb = nb;
        // inner core: core alloy below its liquidus (light elements keep the outer core liquid)
        for i in 0..n { if F::class_of(self.p.mat[i]) == 0 { self.p.mat[i] = if self.temp[i] < core_liquidus_t(self.pres[i]) && self.pres[i] > 0.0 { MAT_IRON_SOLID } else { MAT_IRON }; } } }
    /// Accelerations (gravity tree + GDF pressure + centrifugal) and du/dt.
    fn forces(&self) -> Vec<(V3, f64)> { let p = &self.p; let n = p.pos.len(); let tree = Tree::build(&p.pos, &p.mass);
        F::par_map(n, |i| { let xi = p.pos[i]; let mut a = tree.accel(xi, i, self.h[i], 0.6); let mut du = 0.0;
            for &j in &self.nb[i] { if j == i { continue; } let dx = [xi[0] - p.pos[j][0], xi[1] - p.pos[j][1], xi[2] - p.pos[j][2]]; let r = norm(dx); if r == 0.0 { continue; }
                let gw = 0.5 * (F::dw(r, self.h[i]) + F::dw(r, self.h[j])) / r; // grad_i W = gw * dx
                let rr = self.rho[i] * self.rho[j]; let f = -p.mass[j] * (self.pres[i] + self.pres[j]) / rr * gw; for k in 0..3 { a[k] += f * dx[k]; }
                let dv = [p.vel[i][0] - p.vel[j][0], p.vel[i][1] - p.vel[j][1], p.vel[i][2] - p.vel[j][2]];
                du += p.mass[j] * self.pres[i] / rr * gw * (dv[0] * dx[0] + dv[1] * dx[1] + dv[2] * dx[2]); }
            let w2 = self.omega * self.omega; a[0] += w2 * xi[0]; a[1] += w2 * xi[1]; (a, du) }) }
    /// One damped step: CFL dt = 0.25 h / c; damping removes a fraction of each velocity and adds that kinetic energy to u.
    pub fn step(&mut self, damp: f64) -> f64 { let n = self.p.pos.len();
        let dt = (0..n).map(|i| 0.25 * self.h[i] / self.mat(i).sound(self.rho[i], self.u[i])).fold(f64::INFINITY, f64::min);
        let fa = self.forces();
        for i in 0..n { let (a, du) = fa[i]; self.u[i] = (self.u[i] + du * dt).max(0.0); let mut v2a = 0.0; let mut v2b = 0.0;
            for k in 0..3 { let v = self.p.vel[i][k] + a[k] * dt; let vd = v * (1.0 - damp); v2a += v * v; v2b += vd * vd; self.p.vel[i][k] = vd; self.p.pos[i][k] += vd * dt; }
            let q = 0.5 * (v2a - v2b); self.u[i] += q; self.heat_from_damping += q * self.p.mass[i]; }
        self.density(); dt }
    /// Cooling phase (time-compressed): the hot run keeps every joule (no radiation), but Earth lost most accretion and core
    /// formation heat over ~4.5 Gyr. This relaxes each parcel's temperature a fraction `frac` per step toward the adiabat
    /// T = T_p (rho/rho0)^Gamma, Gamma = a + b (Tillotson's low-energy Grueneisen parameter; dlnT/dlnrho = Gamma on an
    /// isentrope), anchored at the cited mantle potential temperature (materials.json, Katsura et al. 2010); the core's adiabat
    /// starts above the mantle's bottom by the cited boundary-layer contrast (Lay et al. 1998). The heat
    /// removed is counted in `heat_removed`. The time scale is not physical; only the end state is used.
    pub fn cool_toward_adiabat(&mut self, frac: f64) { let tp = material_num("", "initial_temperature_K"); let dt_tbl = material_num("", "cmb_tbl_contrast_K"); let n = self.p.pos.len();
        // mantle: T = T_p (rho/rho0)^Gamma from the surface down. Core: the core cools only through the base of the mantle,
        // so its adiabat starts at the mantle-bottom temperature plus the cited boundary-layer contrast, at the top-of-core
        // density, both read from the parcels (90th-percentile silicate density, 10th-percentile iron density).
        let pct = |mut v: Vec<f64>, q: f64| -> f64 { if v.is_empty() { return 0.0; } v.sort_by(|a, b| a.partial_cmp(b).unwrap()); v[((v.len() - 1) as f64 * q) as usize] };
        let (fe, si) = (&self.mats[0], &self.mats[1]); let g = |m: &Till| m.a + m.b;
        let rho_si_bot = pct((0..n).filter(|&i| F::class_of(self.p.mat[i]) == 1).map(|i| self.rho[i]).collect(), 0.9);
        let rho_fe_top = pct((0..n).filter(|&i| F::class_of(self.p.mat[i]) == 0).map(|i| self.rho[i]).collect(), 0.1).max(fe.rho0);
        let t_top = tp * (rho_si_bot / si.rho0).max(1.0).powf(g(si)) + dt_tbl;
        for i in 0..n { let c = F::class_of(self.p.mat[i]); let m = &self.mats[c];
            let tt = if c == 0 { t_top * (self.rho[i] / rho_fe_top).max(1.0).powf(g(fe)) } else { tp * (self.rho[i] / m.rho0).max(1.0).powf(g(si)) };
            let target = m.e_cold(self.rho[i]) + m.cv * tt; let du = frac * (target - self.u[i]); if du < 0.0 { self.u[i] += du; self.heat_removed -= du * self.p.mass[i]; } } }
    pub fn as_state(&self) -> F::State { F::raw_state(self.p.clone(), self.h.clone(), self.rho.clone(), self.omega) }
    pub fn measure(&self) -> Figure { F::measure(&self.as_state()) }
    pub fn boundaries(&self) -> Boundaries { let s = self.as_state(); let b = F::boundaries(&s); let n = self.p.pos.len(); let m: f64 = self.p.mass.iter().sum();
        let mut com = [0.0; 3]; for i in 0..n { for k in 0..3 { com[k] += self.p.mass[i] * self.p.pos[i][k] / m; } }
        let r = |i: usize| norm([self.p.pos[i][0] - com[0], self.p.pos[i][1] - com[1], self.p.pos[i][2] - com[2]]);
        let mut sol: Vec<f64> = (0..n).filter(|&i| self.p.mat[i] == MAT_IRON_SOLID).map(r).filter(|&x| x < b.cmb).collect(); sol.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let mut all: Vec<(f64, usize)> = (0..n).map(|i| (r(i), i)).collect(); all.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        let tc = all.iter().take(20).map(|&(_, i)| self.temp[i]).sum::<f64>() / 20.0_f64.min(n as f64); let pc = all.iter().take(20).map(|&(_, i)| self.pres[i]).sum::<f64>() / 20.0_f64.min(n as f64);
        Boundaries { separation: b.separation, cmb: b.cmb, n_solid: sol.len(), icb: if sol.is_empty() { 0.0 } else { sol[(sol.len() * 95 / 100).min(sol.len() - 1)] }, t_centre: tc, p_centre: pc } }
    /// Bake (same 6-float layout as formation::bake: x, y, z, material, density, h) plus a 7th file-level array is not used.
    pub fn bake(&self) -> Vec<f32> { let mut v = F::bake(&self.as_state()); let n = self.p.pos.len(); for i in 0..n { v[i * 6 + 3] = self.p.mat[i] as f32; } v }
}
pub struct Boundaries { pub separation: f64, pub cmb: f64, pub n_solid: usize, pub icb: f64, pub t_centre: f64, pub p_centre: f64 }

#[cfg(test)]
mod tests { use super::*;
    #[test] fn tillotson_full_form() { let fe = Till::from_data("iron"); assert_eq!(fe.pressure(7800.0, 0.0), 0.0);
        let p = fe.pressure(7800.0 * 1.2, 1e6); let mu = 0.2; let eta = 1.2; let want = (0.5 + 1.5 / (1e6 / (9.5e6 * eta * eta) + 1.0)) * 9360.0 * 1e6 + 1.28e11 * mu + 1.05e11 * mu * mu; assert!((p / want - 1.0).abs() < 1e-12);
        assert!(fe.pressure(9000.0, 2e6) > fe.pressure(9000.0, 0.0), "heat must add pressure"); }
    #[test] fn cold_curve_and_temperature_roundtrip() { let du = Till::from_data("dunite"); assert!(du.e_cold(3500.0).abs() < 1.0); assert!(du.e_cold(5000.0) > 0.0);
        let r = 5200.0; let u = du.e_cold(r) + du.cv * 2500.0; assert!((du.temperature(r, u) - 2500.0).abs() < 1.0);
        let p = du.pressure(r, u); assert!((du.rho_at(2500.0, p) / r - 1.0).abs() < 1e-3); }
    #[test] fn melting_curve_matches_anzellini_icb() { // Anzellini 2013: ~6230 K at 330 GPa (inner-core boundary)
        let t = iron_melting_t(330e9); assert!((t - 6230.0).abs() < 500.0, "{t}"); } // paper: 6230 +- 500 K
    #[test] fn light_elements_keep_the_outer_core_liquid() { // CMB 136 GPa ~4000 K (Lay et al. 2008); ICB 330 GPa ~5000-6000 K
        let cmb = core_liquidus_t(136e9); assert!(cmb < 4000.0 && iron_melting_t(136e9) > 4000.0, "alloy {cmb} must melt below the CMB temperature");
        let icb = core_liquidus_t(330e9); assert!(icb > 5000.0 && icb < 6000.0, "ICB liquidus {icb}"); }
    #[test] fn rb22_alpha_is_order_unity() { let a = rb22_alpha(); assert!(a > 0.5 && a < 10.0, "{a}"); }
    #[test] fn hot_mix_sinks_iron_and_heats() { let mut s = Hot::mix(2000, 7, "dunite", C::omega_earth); let b0 = s.boundaries().separation; let u0: f64 = s.u.iter().sum();
        s_relax(&mut s, 300); let b1 = s.boundaries().separation; let u1: f64 = s.u.iter().sum();
        assert!(b1 > b0 + 0.08, "separation {b0} -> {b1}"); assert!(u1 > u0, "sinking must heat: {u0} -> {u1}"); assert!(s.heat_from_damping > 0.0); }
    fn s_relax(s: &mut Hot, k: usize) { for _ in 0..k { s.step(0.05); } }
}
