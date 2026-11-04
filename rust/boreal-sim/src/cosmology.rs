//! Spacetime and expansion (the Friedmann equation plus a quadratic inflaton).
//!
//! H² = 8πG ρ / 3 − k c² / a² + Λ c² / 3
//! with ρ the mass density. The panel reports energy density ρ c² in J/m³.
//!
//! Inflaton (reduced Planck units, M_pl = 1, so 8πG = 1): V = ½ m² φ²,
//! φ̈ + 3 H φ̇ + V'(φ) = 0, ρ_φ = ½ φ̇² + V. Slow-roll ends at ε = 2/φ² = 1,
//! which is when the field starts oscillating (Liddle & Lyth, Cosmological Inflation
//! and Large-Scale Structure, 2000). Defaults are chosen so that is about 60 e-folds
//! and the end sits near 10⁻³² s. A small Γ during this stage is editable; the
//! perturbative reheating Boltzmann system lives in `reheating.rs` and starts at handoff.
//!
//! After inflation the scale factor is the flat ΛCDM integral
//! dt = d(ln a) / H(a), with Planck 2018 H0 = 67.4 km/s/Mpc, Ω_m = 0.315,
//! Ω_Λ = 0.685, Ω_r = 9.1×10⁻⁵ (Planck Collaboration 2018, A&A 641 A6).
//! G, c, ħ, k_B are CODATA 2018. T0 = 2.725 K (Fixsen 2009).

use crate::params;

pub const PLANCK_S: f64 = crate::cosmic_time::PLANCK_S;
pub const C: f64 = 299_792_458.0;
pub const G: f64 = 6.674_30e-11;
pub const HBAR: f64 = 1.054_571_817e-34;
pub const K_B: f64 = 1.380_649e-23;
pub const H0_KM: f64 = 67.4;
pub const OMEGA_M: f64 = 0.315;
pub const OMEGA_L: f64 = 0.685;
pub const OMEGA_R: f64 = 9.1e-5;
pub const T_CMB: f64 = 2.725;
pub const MPC: f64 = 3.085_677_581_491_367_3e22;
pub const YEAR_S: f64 = crate::cosmic_time::YEAR_S;

/// Inflaton mass in reduced-Planck units (1/t_P). Ends inflation near 10⁻³² s.
pub fn default_mass_planck() -> f64 {
    17.3 / (1e-32 / PLANCK_S)
}
pub fn default_phi() -> f64 {
    242.0_f64.sqrt()
}
pub fn default_phi_dot() -> f64 {
    -default_mass_planck() * (2.0_f64 / 3.0).sqrt()
}
/// Λ such that Λ c² / 3 = Ω_Λ H0².
pub fn default_lambda() -> f64 {
    3.0 * default_h0() * default_h0() * OMEGA_L / (C * C)
}

pub fn default_h0() -> f64 {
    params::get("H0", H0_KM) * 1000.0 / MPC
}

#[derive(Clone, Debug)]
pub struct Cosmos {
    pub t: f64,
    pub a: f64,
    pub h: f64,
    pub n_efolds: f64,
    pub rho_r: f64,
    pub rho_m: f64,
    pub rho_l: f64,
    pub rho_phi: f64,
    pub rho: f64,
    pub temperature: f64,
    pub phi: f64,
    pub phi_dot: f64,
    pub rho_crit: f64,
    pub omega_r: f64,
    pub omega_m: f64,
    pub omega_l: f64,
    pub omega_phi: f64,
    pub w: f64,
    pub hubble_radius: f64,
    pub z: f64,
    pub epsilon: f64,
    pub inflation_ended: f64,
    pub t_inflation_end: f64,
    pub era: &'static str,
    pub planet_ready: f64,
    pub planet_day: f64,
    pub planet_hour: f64,
}

#[derive(Clone, Copy)]
struct P {
    g: f64,
    c: f64,
    hbar: f64,
    k_b: f64,
    lambda: f64,
    k_curv: f64,
    h0: f64,
    om: f64,
    ol: f64,
    orr: f64,
    mass: f64,
    phi0: f64,
    pi0: f64,
    gamma: f64,
    t_cmb: f64,
}

fn read_p() -> P {
    let h0 = params::get("H0", H0_KM) * 1000.0 / MPC;
    let ol = params::get("omega_lambda", OMEGA_L);
    let c = params::get("c", C);
    P {
        g: params::get("G", G),
        c,
        hbar: params::get("hbar", HBAR),
        k_b: params::get("k_B", K_B),
        lambda: params::get("Lambda", 3.0 * h0 * h0 * ol / (c * c)),
        k_curv: params::get("k", 0.0),
        h0,
        om: params::get("omega_m", OMEGA_M),
        ol,
        orr: params::get("omega_r", OMEGA_R),
        mass: params::get("inflaton_mass", default_mass_planck()),
        phi0: params::get("phi0", default_phi()),
        pi0: params::get("phi_dot0", default_phi_dot()),
        gamma: params::get("Gamma_inflation", default_mass_planck() * 1e-3),
        t_cmb: params::get("T_cmb", T_CMB),
    }
}

fn h_of_a(a: f64, p: &P) -> f64 {
    let a = a.max(1e-30);
    let rho_c = 3.0 * p.h0 * p.h0 / (8.0 * std::f64::consts::PI * p.g); // kg/m³
    let rho = p.om * rho_c / a.powi(3) + p.orr * rho_c / a.powi(4);
    let h2 = 8.0 * std::f64::consts::PI * p.g * rho / 3.0 + p.lambda * p.c * p.c / 3.0
        - p.k_curv * p.c * p.c / (a * a);
    h2.max(0.0).sqrt()
}

fn param_key(p: &P) -> u128 {
    let bits = |x: f64| x.to_bits() as u128;
    bits(p.g) ^ bits(p.c).rotate_left(11) ^ bits(p.lambda).rotate_left(22) ^ bits(p.h0).rotate_left(33)
        ^ bits(p.om).rotate_left(44) ^ bits(p.ol).rotate_left(55) ^ bits(p.orr).rotate_left(7) ^ bits(p.k_curv).rotate_left(17)
        ^ bits(p.mass).rotate_left(3) ^ bits(p.phi0) ^ bits(p.pi0).rotate_left(9) ^ bits(p.gamma).rotate_left(13) ^ bits(p.t_cmb).rotate_left(19)
}

struct ScaleCache { key: u128, samples: Vec<(f64, f64)> }
thread_local! { static SCALE: std::cell::RefCell<Option<ScaleCache>> = const { std::cell::RefCell::new(None) }; }

fn scale_samples() -> Vec<(f64, f64)> {
    let p = read_p();
    let key = param_key(&p);
    let hit = SCALE.with(|c| c.borrow().as_ref().filter(|c| c.key == key).map(|c| c.samples.clone()));
    if let Some(s) = hit { return s; }
    let n = 2000;
    let ln0 = (1e-14_f64).ln();
    let ln1 = 0.0_f64;
    let dln = (ln1 - ln0) / n as f64;
    let mut t = 0.0;
    let mut samples = Vec::with_capacity(n + 1);
    samples.push((1e-14, 0.0));
    for i in 0..n {
        let a = (ln0 + (i as f64 + 1.0) * dln).exp();
        let h = h_of_a((ln0 + (i as f64 + 0.5) * dln).exp(), &p);
        if h > 0.0 { t += dln / h; }
        samples.push((a, t));
    }
    SCALE.with(|c| *c.borrow_mut() = Some(ScaleCache { key, samples: samples.clone() }));
    samples
}

/// Seconds from a = 0 to this scale factor, for the current parameters.
pub fn time_of_scale(a_target: f64) -> f64 {
    if !(a_target > 0.0) { return 0.0; }
    let s = scale_samples();
    if a_target <= s[0].0 { return 0.0; }
    if a_target >= s[s.len() - 1].0 { return s[s.len() - 1].1; }
    let i = s.partition_point(|x| x.0 < a_target).saturating_sub(1);
    let (a0, t0) = s[i];
    let (a1, t1) = s[(i + 1).min(s.len() - 1)];
    if a1 <= a0 { return t0; }
    let u = (a_target.ln() - a0.ln()) / (a1.ln() - a0.ln());
    t0 + (t1 - t0) * u
}

fn scale_of_time(t: f64) -> f64 {
    if !(t > 0.0) { return 0.0; }
    let s = scale_samples();
    if t >= s[s.len() - 1].1 { return s[s.len() - 1].0; }
    let i = s.partition_point(|x| x.1 < t).saturating_sub(1);
    let (a0, t0) = s[i];
    let (a1, t1) = s[(i + 1).min(s.len() - 1)];
    if t1 <= t0 { return a0; }
    let u = ((t - t0) / (t1 - t0)).clamp(0.0, 1.0);
    (a0.ln() + (a1.ln() - a0.ln()) * u).exp()
}

#[derive(Clone)]
struct InflStep {
    t: f64,
    ln_a: f64,
    phi: f64,
    pi: f64,
    h_si: f64,
    eps: f64,
    rho: f64,
}

#[derive(Clone)]
struct InflEnd {
    steps: Vec<InflStep>,
    t_end: f64,
    n: f64,
}

fn energy_density(h_si: f64, p: &P) -> f64 {
    // ρ_energy = 3 c² H² / (8πG)
    3.0 * p.c * p.c * h_si * h_si / (8.0 * std::f64::consts::PI * p.g)
}

fn integrate_inflation(p: &P) -> InflEnd {
    let m = p.mass;
    let mut phi = p.phi0;
    let mut pi = p.pi0;
    let mut ln_a = 0.0;
    let mut tau = 1.0; // start at one Planck time
    let mut steps = Vec::with_capacity(2048);
    let mut n_end = 0.0;
    let mut guard = 0;
    let push = |steps: &mut Vec<InflStep>, tau: f64, ln_a: f64, phi: f64, pi: f64, p: &P| {
        let rho_n = 0.5 * pi * pi + 0.5 * p.mass * p.mass * phi * phi;
        let h_nat = (rho_n / 3.0).max(0.0).sqrt();
        let h_si = h_nat / PLANCK_S;
        let eps = if phi.abs() > 1e-8 { 2.0 / (phi * phi) } else { f64::INFINITY };
        steps.push(InflStep { t: tau * PLANCK_S, ln_a, phi, pi, h_si, eps, rho: energy_density(h_si, p) });
    };
    push(&mut steps, tau, ln_a, phi, pi, p);
    while phi * phi > 2.0 && tau < 1e14 && guard < 20_000 {
        guard += 1;
        let deriv = |ph: f64, piv: f64| -> (f64, f64, f64) {
            let rho_n = 0.5 * piv * piv + 0.5 * m * m * ph * ph;
            let h = (rho_n / 3.0).max(0.0).sqrt();
            let dph = piv;
            let dpi = -3.0 * h * piv - m * m * ph - p.gamma * piv;
            (dph, dpi, h)
        };
        let h = deriv(phi, pi).2.max(1e-30);
        let dt = 0.05 / h;
        let k1 = deriv(phi, pi);
        let k2 = deriv(phi + 0.5 * dt * k1.0, pi + 0.5 * dt * k1.1);
        let k3 = deriv(phi + 0.5 * dt * k2.0, pi + 0.5 * dt * k2.1);
        let k4 = deriv(phi + dt * k3.0, pi + dt * k3.1);
        phi += dt * (k1.0 + 2.0 * k2.0 + 2.0 * k3.0 + k4.0) / 6.0;
        pi += dt * (k1.1 + 2.0 * k2.1 + 2.0 * k3.1 + k4.1) / 6.0;
        ln_a += dt * (k1.2 + 2.0 * k2.2 + 2.0 * k3.2 + k4.2) / 6.0;
        tau += dt;
        if guard % 4 == 0 {
            push(&mut steps, tau, ln_a, phi, pi, p);
        }
        n_end = ln_a;
    }
    push(&mut steps, tau, ln_a, phi, pi, p);
    let last = steps.last().cloned().unwrap();
    InflEnd { t_end: last.t, n: n_end, steps }
}

thread_local! { static INFL: std::cell::RefCell<Option<(u128, InflEnd)>> = const { std::cell::RefCell::new(None) }; }

fn inflation_cached() -> InflEnd {
    let p = read_p();
    let key = param_key(&p);
    if let Some(hit) = INFL.with(|c| c.borrow().as_ref().filter(|c| c.0 == key).map(|c| c.1.clone())) {
        return hit;
    }
    let end = integrate_inflation(&p);
    INFL.with(|c| *c.borrow_mut() = Some((key, end.clone())));
    end
}

fn sample_infl(steps: &[InflStep], t: f64) -> InflStep {
    if steps.is_empty() || t <= steps[0].t {
        return steps[0].clone();
    }
    if t >= steps[steps.len() - 1].t {
        return steps[steps.len() - 1].clone();
    }
    let i = steps.partition_point(|s| s.t < t).saturating_sub(1);
    let a = &steps[i];
    let b = &steps[(i + 1).min(steps.len() - 1)];
    let u = if b.t > a.t { ((t - a.t) / (b.t - a.t)).clamp(0.0, 1.0) } else { 0.0 };
    let lerp = |x: f64, y: f64| x + (y - x) * u;
    InflStep {
        t,
        ln_a: lerp(a.ln_a, b.ln_a),
        phi: lerp(a.phi, b.phi),
        pi: lerp(a.pi, b.pi),
        h_si: lerp(a.h_si, b.h_si),
        eps: lerp(a.eps, b.eps),
        rho: lerp(a.rho, b.rho),
    }
}

/// g* that makes ρ_r(T0) = Ω_r ρ_crit with the photon formula. ≈ 3.36 (photons + neutrinos).
pub(crate) fn g_star_cmb(p: &P) -> f64 {
    let rho_c = 3.0 * p.c * p.c * p.h0 * p.h0 / (8.0 * std::f64::consts::PI * p.g);
    let rho_r = p.orr * rho_c * p.c * p.c;
    let hc = p.hbar * p.c;
    let factor = (std::f64::consts::PI * std::f64::consts::PI / 30.0) * (p.k_b * p.t_cmb).powi(4) / hc.powi(3);
    if factor > 0.0 { rho_r / factor } else { f64::NAN }
}

pub(crate) fn temperature_of_scale(a: f64, p: &P) -> f64 {
    if a > 0.0 { p.t_cmb / a } else { f64::NAN }
}

/// State at cosmic time `t` seconds. `t == 0` is nothing. `t < 0` is outside the model.
pub fn at_time(t: f64) -> Cosmos {
    let p = read_p();
    let blank = |era: &'static str| Cosmos {
        t,
        a: 0.0,
        h: 0.0,
        n_efolds: 0.0,
        rho_r: 0.0,
        rho_m: 0.0,
        rho_l: 0.0,
        rho_phi: 0.0,
        rho: 0.0,
        temperature: 0.0,
        phi: 0.0,
        phi_dot: 0.0,
        rho_crit: 0.0,
        omega_r: 0.0,
        omega_m: 0.0,
        omega_l: 0.0,
        omega_phi: 0.0,
        w: 0.0,
        hubble_radius: 0.0,
        z: 0.0,
        epsilon: 0.0,
        inflation_ended: 0.0,
        t_inflation_end: 0.0,
        era,
        planet_ready: 0.0,
        planet_day: f64::NAN,
        planet_hour: f64::NAN,
    };
    if !t.is_finite() {
        return blank("outside model");
    }
    if t < 0.0 {
        return blank("outside model — before the expansion");
    }
    if t == 0.0 {
        return blank("nothing — no time has passed");
    }
    let infl = inflation_cached();
    let (planet_day, planet_hour) = crate::cosmic_time::planet_clock(t);
    let earth = 9.2e9 * YEAR_S;
    if t < infl.t_end {
        let s = sample_infl(&infl.steps, t);
        let a_end = scale_of_time(infl.t_end).max(1e-30);
        let a = a_end * (s.ln_a - infl.n).exp();
        let rho_phi = s.rho;
        let rho_c = energy_density(s.h_si, &p);
        // de Sitter temperature ħH/2πk (Gibbons & Hawking 1977). Radiation is not a thermal bath yet.
        let t_hawking = p.hbar * s.h_si / (2.0 * std::f64::consts::PI * p.k_b);
        return pack(t, a, s.h_si, s.ln_a, 0.0, 0.0, 0.0, rho_phi, t_hawking, s.phi, s.pi, rho_c, s.eps, 0.0, infl.t_end, "inflation", 0.0, planet_day, planet_hour, &p);
    }
    let a = scale_of_time(t);
    let h = h_of_a(a, &p);
    let rho_c_mass = 3.0 * p.h0 * p.h0 / (8.0 * std::f64::consts::PI * p.g);
    let rho_m = p.om * rho_c_mass / a.powi(3) * p.c * p.c;
    let rho_r = p.orr * rho_c_mass / a.powi(4) * p.c * p.c;
    let rho_l = p.lambda * p.c.powi(4) / (8.0 * std::f64::consts::PI * p.g);
    let temp = temperature_of_scale(a, &p);
    let era = if temp > 1.0e12 {
        "quark"
    } else if temp > 1.0e9 {
        "nucleosynthesis"
    } else if (temp - 3000.0).abs() / 3000.0 < 0.3 {
        "recombination"
    } else if rho_l > rho_m && rho_l > rho_r {
        if (t - 13.8e9 * YEAR_S).abs() < YEAR_S { "today" } else if t >= earth { "Sun and Earth" } else { "dark energy" }
    } else if rho_m > rho_r {
        "matter"
    } else {
        "radiation"
    };
    pack(t, a, h, infl.n, rho_r, rho_m, rho_l, 0.0, temp, 0.0, 0.0, energy_density(h, &p), 1.0, 1.0, infl.t_end, era, if t >= earth { 1.0 } else { 0.0 }, planet_day, planet_hour, &p)
}

fn pack(t: f64, a: f64, h: f64, n: f64, rho_r: f64, rho_m: f64, rho_l: f64, rho_phi: f64, temperature: f64, phi: f64, phi_dot: f64, rho_crit: f64, eps: f64, ended: f64, t_end: f64, era: &'static str, planet_ready: f64, planet_day: f64, planet_hour: f64, p: &P) -> Cosmos {
    let rho = rho_r + rho_m + rho_l + rho_phi;
    let frac = |x: f64| if rho > 0.0 { x / rho } else { 0.0 };
    // w = p/ρ. Radiation 1/3, matter 0, Λ −1, inflaton ≈ −1 while slow-rolling.
    let w = if rho > 0.0 {
        (rho_r / 3.0 - rho_l + rho_phi * (if eps < 1.0 { -1.0 } else { 0.0 })) / rho
    } else {
        0.0
    };
    Cosmos {
        t,
        a,
        h,
        n_efolds: n,
        rho_r,
        rho_m,
        rho_l,
        rho_phi,
        rho,
        temperature,
        phi,
        phi_dot,
        rho_crit,
        omega_r: frac(rho_r),
        omega_m: frac(rho_m),
        omega_l: frac(rho_l),
        omega_phi: frac(rho_phi),
        w,
        hubble_radius: if h > 0.0 { p.c / h } else { f64::INFINITY },
        z: if a > 0.0 { 1.0 / a - 1.0 } else { f64::NAN },
        epsilon: eps,
        inflation_ended: ended,
        t_inflation_end: t_end,
        era,
        planet_ready,
        planet_day,
        planet_hour,
    }
}

/// 512 log-spaced samples from one Planck time to today: t, a, H, T, ρ.
pub fn sample_table() -> Vec<f64> {
    let t0 = PLANCK_S;
    let t1 = 13.8e9 * YEAR_S;
    let n = 512;
    let mut out = Vec::with_capacity(n * 5);
    for i in 0..n {
        let u = i as f64 / (n - 1) as f64;
        let t = (t0.ln() + (t1.ln() - t0.ln()) * u).exp();
        let s = at_time(t);
        out.extend_from_slice(&[s.t, s.a, s.h, s.temperature, s.rho]);
    }
    out
}

/// Handoff into reheating: the inflation trajectory at the moment ε reaches 1.
/// ρ_φ is the inflaton energy; radiation has not been created yet.
pub fn handoff() -> Cosmos {
    let p = read_p();
    let infl = inflation_cached();
    let last = infl.steps.last().cloned().expect("inflation steps");
    let a_end = scale_of_time(infl.t_end).max(1e-30);
    let t_hawking = p.hbar * last.h_si / (2.0 * std::f64::consts::PI * p.k_b);
    pack(last.t, a_end, last.h_si, infl.n, 0.0, 0.0, 0.0, last.rho, t_hawking, last.phi, last.pi, energy_density(last.h_si, &p), last.eps, 1.0, infl.t_end, "inflation", 0.0, f64::NAN, f64::NAN, &p)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nothing_at_zero_and_planck_scale_at_one_cycle() {
        let z = at_time(0.0);
        assert_eq!(z.a, 0.0);
        assert_eq!(z.era, "nothing — no time has passed");
        let s = at_time(PLANCK_S);
        assert!(s.a.is_finite() && s.a > 0.0, "a {}", s.a);
        assert!(s.h.is_finite() && s.h > 0.0, "H {}", s.h);
        assert!(s.phi > 1.0 && s.phi < 100.0, "phi {}", s.phi);
        assert!(s.rho.is_finite() && s.rho > 0.0);
        assert!(s.epsilon.is_finite());
    }

    #[test]
    fn inflation_is_about_sixty_efolds_near_1e_minus_32() {
        let s = handoff();
        assert!((s.n_efolds - 60.0).abs() < 8.0, "N {}", s.n_efolds);
        assert!((s.t_inflation_end / 1e-32).ln().abs() < 1.5, "t_end {}", s.t_inflation_end);
        assert!((s.epsilon - 1.0).abs() < 0.15, "eps {}", s.epsilon);
    }

    #[test]
    fn radiation_and_matter_scaling() {
        let a10 = at_time(10.0).a;
        let a1000 = at_time(1000.0).a;
        let ratio = a1000 / a10;
        assert!((ratio / 10.0 - 1.0).abs() < 0.02, "RD ratio {ratio}");
        let t1 = time_of_scale(0.02);
        let t2 = time_of_scale(0.08);
        let got = at_time(t2).a / at_time(t1).a;
        let expect = (t2 / t1).powf(2.0 / 3.0);
        assert!((got / expect - 1.0).abs() < 0.03, "MD {got} vs {expect}");
    }

    #[test]
    fn today_age_and_cmb_and_recombination_and_bbn() {
        let age = time_of_scale(1.0) / YEAR_S / 1e9;
        assert!((age - 13.8).abs() < 0.1, "age {age}");
        let today = at_time(13.8e9 * YEAR_S);
        assert!((today.a - 1.0).abs() < 0.05, "a {}", today.a);
        assert!((today.temperature - 2.725).abs() < 0.05, "T {}", today.temperature);
        // T = T0/a, so z = T/T0 − 1 at T = 3000 K.
        let z = 3000.0 / T_CMB - 1.0;
        assert!((z - 1100.0).abs() < 50.0, "z {z}");
        let bbn = at_time(100.0);
        assert!(bbn.temperature > 1e8 && bbn.temperature < 1e10, "T {}", bbn.temperature);
    }

    #[test]
    fn changing_g_or_lambda_changes_outputs() {
        let base_rho = at_time(13.8e9 * YEAR_S).rho;
        let base_age = time_of_scale(1.0);
        {
            let mut m = std::collections::BTreeMap::new();
            m.insert("G".into(), G * 2.0);
            let _g = params::activate(m);
            let rho = at_time(13.8e9 * YEAR_S).rho;
            assert!((rho - base_rho).abs() / base_rho > 0.2, "{rho} vs {base_rho}");
        }
        {
            let mut m = std::collections::BTreeMap::new();
            m.insert("Lambda".into(), 0.0);
            let _g = params::activate(m);
            let age = time_of_scale(1.0);
            assert!((age - base_age).abs() / base_age > 0.02, "age {age} vs {base_age}");
        }
    }
}
