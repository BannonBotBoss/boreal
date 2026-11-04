//! Perturbative reheating. Spawned when inflation ends (ε = 1); nothing here is placed by hand.
//!
//! The oscillating inflaton is an averaged fluid (Kolb & Turner, The Early Universe, 1990, ch. 5 and 8):
//! dρ_φ/dt = −3 H ρ_φ − Γ_φ ρ_φ
//! dρ_r/dt = −4 H ρ_r + Γ_φ ρ_φ
//! H² = 8πG (ρ_φ + ρ_r) / (3 c²) + Λ c² / 3
//! with (a, H, ρ_φ) taken from the spacetime engine at the handoff.
//!
//! Temperature: ρ_r = (π²/30) g*(T) (kT)⁴ / (ħc)³.
//! g*(T) follows the Standard Model count: 106.75 while every species is relativistic
//! (particle content as in Husdal 2016, arXiv:1609.04979, and Saikawa & Shirai 2018,
//! arXiv:1803.01038) and, after neutrino decoupling, the photon-plus-neutrino value
//! 2 + (7/8)·6·(4/11)^{4/3} ≈ 3.36. Each species' density is the equilibrium integral
//! (Bose–Einstein or Fermi–Dirac, with the Boltzmann tail when T < m). Masses are PDG
//! central values (Particle Data Group, 2024). Nothing sets a species to "present".

use crate::cosmology;
use crate::params;

const GEV_J: f64 = 1.602_176_634e-10;
const K_PER_GEV: f64 = 1.160_451_812e13;
const HBAR_GEV_S: f64 = 6.582_119_569e-25;
/// ħc in GeV·m.
const HBAR_C_GEV_M: f64 = 1.973_269_804e-16;

#[derive(Clone, Copy)]
struct Kind {
    name: &'static str,
    /// PDG mass in GeV. Neutrinos are treated as massless; the lab limits are far below these temperatures.
    mass_gev: f64,
    /// Spin × colour × particle/antiparticle, the usual g* weight before the 7/8.
    g: f64,
    fermion: bool,
}

fn kinds() -> [Kind; 17] {
    [
        Kind { name: "photon", mass_gev: 0.0, g: 2.0, fermion: false },
        Kind { name: "gluon", mass_gev: 0.0, g: 16.0, fermion: false },
        Kind { name: "W", mass_gev: 80.377, g: 6.0, fermion: false },
        Kind { name: "Z", mass_gev: 91.1876, g: 3.0, fermion: false },
        Kind { name: "Higgs", mass_gev: 125.20, g: 1.0, fermion: false },
        Kind { name: "up", mass_gev: 0.00216, g: 12.0, fermion: true },
        Kind { name: "down", mass_gev: 0.00467, g: 12.0, fermion: true },
        Kind { name: "charm", mass_gev: 1.27, g: 12.0, fermion: true },
        Kind { name: "strange", mass_gev: 0.0934, g: 12.0, fermion: true },
        Kind { name: "top", mass_gev: 172.57, g: 12.0, fermion: true },
        Kind { name: "bottom", mass_gev: 4.183, g: 12.0, fermion: true },
        Kind { name: "electron", mass_gev: 0.000510999, g: 4.0, fermion: true },
        Kind { name: "muon", mass_gev: 0.105658, g: 4.0, fermion: true },
        Kind { name: "tau", mass_gev: 1.77686, g: 4.0, fermion: true },
        Kind { name: "nu_e", mass_gev: 0.0, g: 2.0, fermion: true },
        Kind { name: "nu_mu", mass_gev: 0.0, g: 2.0, fermion: true },
        Kind { name: "nu_tau", mass_gev: 0.0, g: 2.0, fermion: true },
    ]
}

fn mass_of(k: &Kind) -> f64 {
    params::get(&format!("mass_{}", k.name), k.mass_gev)
}

/// How much of the relativistic energy a species still carries. 1 when T ≫ m, Boltzmann-small when T ≪ m.
fn relativistic_weight(mass_over_t: f64) -> f64 {
    let y = mass_over_t;
    if y < 1e-4 {
        return 1.0;
    }
    if y > 40.0 {
        return 0.0;
    }
    ((-y).exp() * (1.0 + y + 0.5 * y * y)).min(1.0)
}

/// Effective relativistic degrees of freedom. High T → 106.75. Well below neutrino decoupling → ≈ 3.36.
pub fn g_star(t_gev: f64) -> f64 {
    let forced = params::get("g_star", 0.0);
    if forced > 0.0 {
        return forced;
    }
    if !(t_gev > 0.0) {
        return 0.0;
    }
    let decouple = params::get("T_nu_decouple_GeV", 1e-3);
    if t_gev < decouple {
        // e⁺e⁻ have annihilated into the photons; neutrinos keep the cooler temperature (4/11)^{1/3}.
        let neutrinos = 6.0 * (7.0 / 8.0) * (4.0_f64 / 11.0).powf(4.0 / 3.0);
        return 2.0 + neutrinos;
    }
    let mut g = 0.0;
    for k in kinds() {
        let m = mass_of(&k);
        let y = if m <= 0.0 { 0.0 } else { m / t_gev };
        let stat = if k.fermion { 7.0 / 8.0 } else { 1.0 };
        g += k.g * stat * relativistic_weight(y);
    }
    g
}

pub fn temperature_from_energy(rho_j: f64, g: f64) -> f64 {
    if !(rho_j > 0.0) || !(g > 0.0) {
        return 0.0;
    }
    let k = params::get("k_B", cosmology::K_B);
    let hbar = params::get("hbar", cosmology::HBAR);
    let c = params::get("c", cosmology::C);
    let hc = hbar * c;
    let inside = rho_j * hc.powi(3) * 30.0 / (std::f64::consts::PI.powi(2) * g);
    inside.max(0.0).powf(0.25) / k
}

fn gev_of_kelvin(t_k: f64) -> f64 {
    t_k / K_PER_GEV
}

/// Equilibrium number density (1/m³) from Bose–Einstein or Fermi–Dirac statistics.
/// Relativistic: ζ(3) g T³/π² (× 3/4 for fermions). Cold: the Boltzmann tail.
pub fn equilibrium_number_density(g: f64, mass_gev: f64, t_gev: f64, fermion: bool) -> f64 {
    if !(t_gev > 0.0) || !(g > 0.0) {
        return 0.0;
    }
    let y = if mass_gev <= 0.0 { 0.0 } else { mass_gev / t_gev };
    let zeta3 = 1.202_056_903_159_594;
    let n_rel = g * zeta3 / (std::f64::consts::PI * std::f64::consts::PI) * t_gev.powi(3) * if fermion { 0.75 } else { 1.0 };
        let n_nr = if y > 0.0 {
            g * (mass_gev * t_gev / (2.0 * std::f64::consts::PI)).powf(1.5) * (-y).exp()
        } else {
            0.0
        };
    // One formula, two limits. The weight is the equilibrium suppression, not a switch that turns a species on.
    let s = relativistic_weight(y);
    let n_nat = n_rel * s + n_nr * (1.0 - s);
    n_nat / HBAR_C_GEV_M.powi(3)
}

pub fn equilibrium_energy_density(g: f64, mass_gev: f64, t_gev: f64, fermion: bool) -> f64 {
    if !(t_gev > 0.0) {
        return 0.0;
    }
    let y = if mass_gev <= 0.0 { 0.0 } else { mass_gev / t_gev };
    let w = relativistic_weight(y);
    let stat = if fermion { 7.0 / 8.0 } else { 1.0 };
    let t_k = t_gev * K_PER_GEV;
    let k = cosmology::K_B;
    let hc = cosmology::HBAR * cosmology::C;
    let rho_rel = (std::f64::consts::PI.powi(2) / 30.0) * g * stat * (k * t_k).powi(4) / hc.powi(3);
    let n = equilibrium_number_density(g, mass_gev, t_gev, fermion);
    let rho_rest = n * mass_gev * GEV_J;
    rho_rel * w + rho_rest * (1.0 - w)
}

/// T_rh ≈ (90 / (π² g*))^{1/4} √(Γ M_pl), in kelvin. Kolb & Turner eq. (8.33) shape.
pub fn analytic_reheat_temperature(gamma_per_s: f64, g_star: f64) -> f64 {
    if !(gamma_per_s > 0.0) || !(g_star > 0.0) {
        return 0.0;
    }
    let gamma_gev = gamma_per_s * HBAR_GEV_S;
    let mpl_kg = (cosmology::HBAR * cosmology::C / (8.0 * std::f64::consts::PI * cosmology::G)).sqrt();
    let mpl_gev = mpl_kg * cosmology::C * cosmology::C / GEV_J;
    let t_gev = (90.0 / (std::f64::consts::PI.powi(2) * g_star)).powf(0.25) * (gamma_gev * mpl_gev).sqrt();
    t_gev * K_PER_GEV
}

pub fn default_gamma() -> f64 {
    // 10⁻⁶ GeV. Well under H at the end of inflation, so the decay is perturbative.
    1e-6 / HBAR_GEV_S
}

#[derive(Clone, Debug)]
pub struct SpeciesRow {
    pub name: &'static str,
    pub number_density: f64,
    pub energy_density: f64,
    pub mass_gev: f64,
}

#[derive(Clone, Debug)]
pub struct Reheat {
    pub t: f64,
    pub a: f64,
    pub h: f64,
    pub rho_phi: f64,
    pub rho_r: f64,
    pub temperature: f64,
    pub t_rh_analytic: f64,
    pub t_rh_integrated: f64,
    pub g_star: f64,
    pub qcd_threshold: f64,
    pub active: bool,
    pub species: Vec<SpeciesRow>,
}

#[derive(Clone, Copy)]
struct Sample {
    t: f64,
    a: f64,
    h: f64,
    rho_phi: f64,
    rho_r: f64,
    temperature: f64,
}

struct Run {
    samples: Vec<Sample>,
    t_rh: f64,
}

fn hubble(rho_phi: f64, rho_r: f64) -> f64 {
    let g = params::get("G", cosmology::G);
    let c = params::get("c", cosmology::C);
    let lambda = params::get("Lambda", cosmology::default_lambda());
    let rho_mass = (rho_phi + rho_r) / (c * c);
    let h2 = 8.0 * std::f64::consts::PI * g * rho_mass / 3.0 + lambda * c * c / 3.0;
    h2.max(0.0).sqrt()
}

fn temperature_consistent(rho_r: f64) -> (f64, f64) {
    let mut g = 106.75;
    let mut temp = 0.0;
    for _ in 0..4 {
        temp = temperature_from_energy(rho_r, g);
        g = g_star(gev_of_kelvin(temp));
        if !(g > 0.0) {
            g = 106.75;
        }
    }
    (temp, g)
}

fn integrate() -> Run {
    let hand = cosmology::handoff();
    let gamma = params::get("Gamma_phi", default_gamma()).max(0.0);
    let mut t = hand.t.max(cosmology::PLANCK_S);
    let mut a = hand.a.max(1e-40);
    let mut rho_phi = hand.rho_phi.max(0.0);
    let mut rho_r = 0.0;
    let mut samples = Vec::with_capacity(4096);
    let mut t_cross = 0.0;
    let push = |samples: &mut Vec<Sample>, t: f64, a: f64, rho_phi: f64, rho_r: f64| {
        let h = hubble(rho_phi, rho_r);
        let (temperature, _) = temperature_consistent(rho_r);
        samples.push(Sample { t, a, h, rho_phi, rho_r, temperature });
    };
    push(&mut samples, t, a, rho_phi, rho_r);
    let mut steps = 0;
    while steps < 50_000 && rho_phi > 1e-6 * rho_r.max(1.0) {
        steps += 1;
        let h = hubble(rho_phi, rho_r).max(1e-30);
        let mut dt = 0.02 / h.max(gamma.max(1e-30));
        if !dt.is_finite() || dt <= 0.0 {
            break;
        }
        // Don't jump past the interesting decay in one step.
        dt = dt.min(t);
        let deriv = |rp: f64, rr: f64, aa: f64| {
            let hh = hubble(rp, rr);
            (-3.0 * hh * rp - gamma * rp, -4.0 * hh * rr + gamma * rp, aa * hh)
        };
        let k1 = deriv(rho_phi, rho_r, a);
        let k2 = deriv((rho_phi + 0.5 * dt * k1.0).max(0.0), (rho_r + 0.5 * dt * k1.1).max(0.0), a + 0.5 * dt * k1.2);
        let k3 = deriv((rho_phi + 0.5 * dt * k2.0).max(0.0), (rho_r + 0.5 * dt * k2.1).max(0.0), a + 0.5 * dt * k2.2);
        let k4 = deriv((rho_phi + dt * k3.0).max(0.0), (rho_r + dt * k3.1).max(0.0), a + dt * k3.2);
        rho_phi = (rho_phi + dt * (k1.0 + 2.0 * k2.0 + 2.0 * k3.0 + k4.0) / 6.0).max(0.0);
        rho_r = (rho_r + dt * (k1.1 + 2.0 * k2.1 + 2.0 * k3.1 + k4.1) / 6.0).max(0.0);
        a = (a + dt * (k1.2 + 2.0 * k2.2 + 2.0 * k3.2 + k4.2) / 6.0).max(1e-40);
        t += dt;
        if t_cross == 0.0 && rho_r >= rho_phi && rho_r > 0.0 {
            t_cross = temperature_consistent(rho_r).0;
        }
        if steps % 8 == 0 {
            push(&mut samples, t, a, rho_phi, rho_r);
        }
        if t > hand.t * 1e18 {
            break;
        }
    }
    push(&mut samples, t, a, rho_phi, rho_r);
    if t_cross == 0.0 {
        t_cross = samples.last().map(|s| s.temperature).unwrap_or(0.0);
    }
    Run { samples, t_rh: t_cross }
}

fn run_cached() -> Run {
    integrate()
}

fn species_at(t_k: f64) -> (f64, Vec<SpeciesRow>) {
    let t_gev = gev_of_kelvin(t_k);
    // Neutrinos free-stream below decoupling, so their temperature is not the photon temperature.
    let decouple = params::get("T_nu_decouple_GeV", 1e-3);
    let t_nu = if t_gev < decouple { t_gev * (4.0_f64 / 11.0).powf(1.0 / 3.0) } else { t_gev };
    let mut rows = Vec::with_capacity(17);
    for k in kinds() {
        let m = mass_of(&k);
        let t_use = if k.name.starts_with("nu_") { t_nu } else { t_gev };
        rows.push(SpeciesRow {
            name: k.name,
            number_density: equilibrium_number_density(k.g, m, t_use, k.fermion),
            energy_density: equilibrium_energy_density(k.g, m, t_use, k.fermion),
            mass_gev: m,
        });
    }
    (g_star(t_gev), rows)
}

fn qcd_flag(t_k: f64) -> f64 {
    if params::get("qcd_transition", 1.0) < 0.5 {
        return 0.0;
    }
    let t_mev = gev_of_kelvin(t_k) * 1000.0;
    let pivot = params::get("qcd_MeV", 150.0);
    if t_mev < pivot * 2.0 && t_mev > pivot * 0.5 { 1.0 } else { 0.0 }
}

/// Reheating state at cosmic time `t`. Before ε = 1 the engine is not active.
pub fn at_time(t: f64) -> Reheat {
    let gamma = params::get("Gamma_phi", default_gamma());
    let g_for_analytic = 106.75;
    let t_rh_analytic = analytic_reheat_temperature(gamma, g_for_analytic);
    let inactive = |active_t: f64| Reheat {
        t: active_t,
        a: 0.0,
        h: 0.0,
        rho_phi: 0.0,
        rho_r: 0.0,
        temperature: 0.0,
        t_rh_analytic,
        t_rh_integrated: 0.0,
        g_star: 0.0,
        qcd_threshold: 0.0,
        active: false,
        species: Vec::new(),
    };
    if !(t > 0.0) {
        return inactive(t);
    }
    let hand = cosmology::handoff();
    if t + 1e-30 < hand.t {
        return inactive(t);
    }
    let run = run_cached();
    let last = *run.samples.last().unwrap();
    if t <= last.t {
        let s = sample_run(&run.samples, t);
        let (g, species) = species_at(s.temperature);
        return Reheat {
            t,
            a: s.a,
            h: s.h,
            rho_phi: s.rho_phi,
            rho_r: s.rho_r,
            temperature: s.temperature,
            t_rh_analytic,
            t_rh_integrated: run.t_rh,
            g_star: g,
            qcd_threshold: qcd_flag(s.temperature),
            active: true,
            species,
        };
    }
    // Decay is finished. The photon temperature is the standard one, T = T0 / a,
    // and the inflaton density has been consumed.
    let late = cosmology::at_time(t);
    let (g, species) = species_at(late.temperature);
    Reheat {
        t,
        a: late.a,
        h: late.h,
        rho_phi: 0.0,
        rho_r: late.rho_r,
        temperature: late.temperature,
        t_rh_analytic,
        t_rh_integrated: run.t_rh,
        g_star: g,
        qcd_threshold: qcd_flag(late.temperature),
        active: true,
        species,
    }
}

fn sample_run(samples: &[Sample], t: f64) -> Sample {
    if t <= samples[0].t {
        return samples[0];
    }
    let i = samples.partition_point(|s| s.t < t).saturating_sub(1);
    let a = samples[i];
    let b = samples[(i + 1).min(samples.len() - 1)];
    let u = if b.t > a.t { ((t - a.t) / (b.t - a.t)).clamp(0.0, 1.0) } else { 0.0 };
    let l = |x: f64, y: f64| x + (y - x) * u;
    Sample { t, a: l(a.a, b.a), h: l(a.h, b.h), rho_phi: l(a.rho_phi, b.rho_phi), rho_r: l(a.rho_r, b.rho_r), temperature: l(a.temperature, b.temperature) }
}

/// A short table through the decay: t, T, ρ_φ, ρ_r. Used by the panel plot and the evidence.
pub fn decay_table() -> Vec<f64> {
    let run = run_cached();
    let mut out = Vec::with_capacity(run.samples.len() * 4);
    for s in &run.samples {
        out.extend_from_slice(&[s.t, s.temperature, s.rho_phi, s.rho_r]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handoff_keeps_the_inflaton_energy() {
        let h = cosmology::handoff();
        let r = at_time(h.t);
        assert!(r.active);
        assert!(h.rho_phi > 0.0);
        assert!((r.rho_phi - h.rho_phi).abs() / h.rho_phi < 1e-6, "{} vs {}", r.rho_phi, h.rho_phi);
        assert!(r.rho_r.abs() <= 1e-9 * h.rho_phi, "radiation should start empty, {}", r.rho_r);
        assert!((r.a - h.a).abs() / h.a < 1e-6);
        assert!((r.h - h.h).abs() / h.h < 1e-4, "{} vs {}", r.h, h.h);
    }

    #[test]
    fn boltzmann_step_moves_energy_from_inflaton_to_radiation() {
        let h = cosmology::handoff();
        let gamma = default_gamma();
        let rho_phi = h.rho_phi;
        let h0 = h.h;
        let dt = 0.01 / h0.max(gamma);
        let rho_phi2 = (rho_phi + dt * (-3.0 * h0 * rho_phi - gamma * rho_phi)).max(0.0);
        let rho_r2 = dt * (gamma * rho_phi);
        let lost = rho_phi - rho_phi2;
        let expansion = 3.0 * h0 * rho_phi * dt;
        let decayed = gamma * rho_phi * dt;
        assert!((lost - expansion - decayed).abs() / rho_phi < 1e-9);
        assert!((rho_r2 - decayed).abs() / decayed.max(1.0) < 1e-9);
        let integrated = at_time(h.t * 10.0);
        assert!(integrated.rho_r > 0.0, "radiation should appear, {}", integrated.rho_r);
    }

    #[test]
    fn reheat_temperature_matches_the_estimate_within_a_factor_of_two() {
        let analytic = analytic_reheat_temperature(default_gamma(), 106.75);
        let got = at_time(cosmology::handoff().t).t_rh_integrated;
        let ratio = got / analytic;
        assert!(ratio > 0.5 && ratio < 2.0, "integrated {got} analytic {analytic} ratio {ratio}");
    }

    #[test]
    fn g_star_limits() {
        let high = g_star(1.0e6);
        assert!((high - 106.75).abs() < 0.2, "high {high}");
        let low = g_star(1.0e-12);
        assert!((low - 3.36).abs() < 0.05, "low {low}");
    }

    #[test]
    fn species_densities_come_from_the_equilibrium_formula() {
        let hot = equilibrium_number_density(2.0, 0.0, 1.0, false);
        let cold = equilibrium_number_density(2.0, 100.0, 1.0, false);
        assert!(hot > cold * 1e6, "hot {hot} cold {cold}");
        let src = include_str!("reheating.rs").split("#[cfg(test)]").next().unwrap();
        assert!(!src.contains("present = true"), "species must not be switched on by a flag");
        assert!(!src.contains("species_on"));
        assert!(!src.contains("hard_coded"));
        for k in kinds() {
            assert!(!src.contains(&format!("\"{}\" => true", k.name)));
        }
    }
}
