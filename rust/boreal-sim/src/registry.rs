//! Engine registry. Instances exist only because `spawn_engine` created them.
//!
//! A spawn rule reads another engine's output. When the number crosses the rule's
//! threshold the child is spawned, and scrubbing the time backwards despawns it.
//! The same time always produces the same automatic set. Manual spawns stay until
//! they are despawned or their parent disappears.

use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, BTreeSet};
use crate::cosmic_time::{self, YEAR_S};
use crate::cosmology;
use crate::params;
use crate::reheating;

pub const HEALTH_IDLE: u8 = 0;
pub const HEALTH_OK: u8 = 1;
pub const HEALTH_WARN: u8 = 2;
pub const HEALTH_BAD: u8 = 3;
pub const HEALTH_INACTIVE: u8 = 4;
pub const HEALTH_OUTSIDE: u8 = 5;
pub const HEALTH_EMPTY: u8 = 6;
pub const HEALTH_NOT_BUILT: u8 = 7;

#[derive(Clone, Debug)]
pub struct Var {
    pub label: String,
    pub unit: String,
    pub value: f64,
    pub min: f64,
    pub max: f64,
    pub n: u32,
}

#[derive(Clone, Debug)]
pub struct Sym {
    pub equation: String,
    pub name: String,
    pub latex: String,
    pub unit: String,
    pub value: f64,
}

#[derive(Clone, Debug)]
pub struct Outcome {
    pub health: u8,
    pub reason: String,
    pub vars: Vec<Var>,
    pub symbols: Vec<Sym>,
    pub outputs: BTreeMap<String, f64>,
}

pub struct ParamDef {
    pub key: &'static str,
    pub label: &'static str,
    pub unit: &'static str,
}

pub struct EqDef {
    pub id: &'static str,
    pub title: &'static str,
    pub latex: &'static str,
}

pub struct Rule {
    pub child: &'static str,
    /// Output name on the parent.
    pub output: &'static str,
    pub above: f64,
    pub below: f64,
    pub cause: &'static str,
    /// Parent output that holds the physical time of the spawn. Empty uses the queried time.
    pub time_output: &'static str,
}

pub trait Engine {
    fn id(&self) -> &'static str;
    fn generates(&self) -> &'static str;
    fn file(&self) -> &'static str;
    fn not_built(&self) -> bool { false }
    fn parameters(&self) -> &'static [ParamDef] { &[] }
    fn equations(&self) -> &'static [EqDef] { &[] }
    fn rules(&self) -> &'static [Rule] { &[] }
    fn evaluate(&self, t: f64, p: &BTreeMap<String, f64>) -> Outcome;
}

fn v(label: &str, unit: &str, value: f64) -> Var {
    Var { label: label.into(), unit: unit.into(), value, min: value, max: value, n: 1 }
}

fn sym(eq: &str, name: &str, latex: &str, unit: &str, value: f64) -> Sym {
    Sym { equation: eq.into(), name: name.into(), latex: latex.into(), unit: unit.into(), value }
}

fn finite_positive(x: f64) -> bool { x.is_finite() && x > 0.0 }

struct Spacetime;
struct ReheatingEng;
struct Nucleosynthesis;
struct Planet;
struct Slice;

const CLIMATE: &str = "climate";
const SOLAR: &str = "solar";
const ENERGY: &str = "energy";
const WIND: &str = "wind";
const HYDRO: &str = "hydro";
const CLOUDS: &str = "clouds";

fn engines() -> &'static [&'static dyn Engine] {
    &[&Spacetime as &dyn Engine, &ReheatingEng, &Nucleosynthesis, &Planet, &Slice]
}

fn find(id: &str) -> Option<&'static dyn Engine> {
    engines().iter().copied().find(|e| e.id() == id || (e.id() == "slice" && matches!(id, "climate" | "solar" | "energy" | "wind" | "hydro" | "clouds")))
}

impl Engine for Spacetime {
    fn id(&self) -> &'static str { "spacetime" }
    fn generates(&self) -> &'static str { "the scale factor, the expansion rate, and the inflaton" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/cosmology.rs" }
    fn parameters(&self) -> &'static [ParamDef] {
        &[
            ParamDef { key: "G", label: "Newton's constant", unit: "m³/kg/s²" },
            ParamDef { key: "c", label: "speed of light", unit: "m/s" },
            ParamDef { key: "hbar", label: "reduced Planck constant", unit: "J·s" },
            ParamDef { key: "k_B", label: "Boltzmann constant", unit: "J/K" },
            ParamDef { key: "Lambda", label: "cosmological constant", unit: "1/m²" },
            ParamDef { key: "k", label: "curvature k", unit: "1/m²" },
            ParamDef { key: "H0", label: "Hubble constant", unit: "km/s/Mpc" },
            ParamDef { key: "omega_m", label: "matter fraction today", unit: "" },
            ParamDef { key: "omega_lambda", label: "dark-energy fraction today", unit: "" },
            ParamDef { key: "omega_r", label: "radiation fraction today", unit: "" },
            ParamDef { key: "inflaton_mass", label: "inflaton mass", unit: "1/t_P" },
            ParamDef { key: "phi0", label: "starting inflaton", unit: "M_pl" },
            ParamDef { key: "phi_dot0", label: "starting inflaton speed", unit: "M_pl/t_P" },
            ParamDef { key: "Gamma_inflation", label: "friction during inflation", unit: "1/t_P" },
            ParamDef { key: "T_cmb", label: "CMB temperature today", unit: "K" },
        ]
    }
    fn equations(&self) -> &'static [EqDef] {
        &[
            EqDef { id: "friedmann", title: "Friedmann", latex: r"H^{2}=\frac{8\pi G}{3}\rho-\frac{k c^{2}}{a^{2}}+\frac{\Lambda c^{2}}{3}" },
            EqDef { id: "inflaton", title: "Inflaton", latex: r"\ddot\varphi+3H\dot\varphi+m^{2}\varphi=0" },
            EqDef { id: "inflaton_rho", title: "Inflaton energy", latex: r"\rho_{\varphi}=\frac{1}{2}\dot\varphi^{2}+\frac{1}{2}m^{2}\varphi^{2}" },
        ]
    }
    fn rules(&self) -> &'static [Rule] {
        &[
            Rule { child: "reheating", output: "inflation_ended", above: 1.0, below: f64::INFINITY, cause: "ε=1", time_output: "t_inflation_end" },
            Rule { child: "planet", output: "planet_ready", above: 1.0, below: f64::INFINITY, cause: "the Earth has formed", time_output: "" },
        ]
    }
    fn evaluate(&self, t: f64, p: &BTreeMap<String, f64>) -> Outcome {
        let _g = params::activate(p.clone());
        let s = cosmology::at_time(t);
        let mut outputs = BTreeMap::new();
        outputs.insert("a".into(), s.a);
        outputs.insert("H".into(), s.h);
        outputs.insert("T".into(), s.temperature);
        outputs.insert("rho".into(), s.rho);
        outputs.insert("epsilon".into(), s.epsilon);
        outputs.insert("inflation_ended".into(), s.inflation_ended);
        outputs.insert("t_inflation_end".into(), s.t_inflation_end);
        outputs.insert("planet_ready".into(), s.planet_ready);
        outputs.insert("N".into(), s.n_efolds);
        let (health, reason) = if t < 0.0 || !t.is_finite() {
            (HEALTH_OUTSIDE, s.era.to_string())
        } else if t == 0.0 {
            (HEALTH_EMPTY, "nothing exists — every output is zero".into())
        } else if !s.a.is_finite() || !s.h.is_finite() || s.rho < 0.0 || s.rho_phi < 0.0 {
            (HEALTH_BAD, "a non-finite expansion or a negative density".into())
        } else if s.a <= 0.0 {
            (HEALTH_BAD, "the scale factor is not positive".into())
        } else {
            (HEALTH_OK, s.era.into())
        };
        let vars = vec![
            v("scale factor a", "", s.a),
            v("Hubble rate", "1/s", s.h),
            v("e-folds", "", s.n_efolds),
            v("radiation density", "J/m³", s.rho_r),
            v("matter density", "J/m³", s.rho_m),
            v("dark-energy density", "J/m³", s.rho_l),
            v("inflaton density", "J/m³", s.rho_phi),
            v("total density", "J/m³", s.rho),
            v("temperature", "K", s.temperature),
            v("inflaton", "M_pl", s.phi),
            v("inflaton speed", "M_pl/t_P", s.phi_dot),
            v("critical density", "J/m³", s.rho_crit),
            v("omega radiation", "", s.omega_r),
            v("omega matter", "", s.omega_m),
            v("omega dark energy", "", s.omega_l),
            v("omega inflaton", "", s.omega_phi),
            v("equation of state w", "", s.w),
            v("Hubble radius", "m", s.hubble_radius),
            v("redshift", "", s.z),
            v("slow-roll epsilon", "", s.epsilon),
        ];
        let symbols = vec![
            sym("friedmann", "H", "H", "1/s", s.h),
            sym("friedmann", "G", "G", "m³/kg/s²", p.get("G").copied().unwrap_or(cosmology::G)),
            sym("friedmann", "rho", r"\rho", "kg/m³", if s.h > 0.0 { 3.0 * s.h * s.h / (8.0 * std::f64::consts::PI * p.get("G").copied().unwrap_or(cosmology::G)) } else { 0.0 }),
            sym("friedmann", "a", "a", "", s.a),
            sym("friedmann", "Lambda", r"\Lambda", "1/m²", p.get("Lambda").copied().unwrap_or(cosmology::default_lambda())),
            sym("friedmann", "c", "c", "m/s", p.get("c").copied().unwrap_or(cosmology::C)),
            sym("friedmann", "k", "k", "1/m²", p.get("k").copied().unwrap_or(0.0)),
            sym("inflaton", "phi", r"\varphi", "M_pl", s.phi),
            sym("inflaton", "phi_dot", r"\dot\varphi", "M_pl/t_P", s.phi_dot),
            sym("inflaton", "m", "m", "1/t_P", p.get("inflaton_mass").copied().unwrap_or(cosmology::default_mass_planck())),
            sym("inflaton_rho", "rho_phi", r"\rho_{\varphi}", "J/m³", s.rho_phi),
        ];
        Outcome { health, reason, vars, symbols, outputs }
    }
}

impl Engine for ReheatingEng {
    fn id(&self) -> &'static str { "reheating" }
    fn generates(&self) -> &'static str { "radiation and particle densities from the decaying inflaton" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/reheating.rs" }
    fn parameters(&self) -> &'static [ParamDef] {
        &[
            ParamDef { key: "Gamma_phi", label: "inflaton decay rate", unit: "1/s" },
            ParamDef { key: "g_star", label: "g* override (0 = compute it)", unit: "" },
            ParamDef { key: "qcd_transition", label: "quark-hadron threshold flag", unit: "0 or 1" },
            ParamDef { key: "qcd_MeV", label: "quark-hadron temperature", unit: "MeV" },
            ParamDef { key: "mass_photon", label: "photon mass", unit: "GeV" },
            ParamDef { key: "mass_gluon", label: "gluon mass", unit: "GeV" },
            ParamDef { key: "mass_W", label: "W mass", unit: "GeV" },
            ParamDef { key: "mass_Z", label: "Z mass", unit: "GeV" },
            ParamDef { key: "mass_Higgs", label: "Higgs mass", unit: "GeV" },
            ParamDef { key: "mass_up", label: "up quark mass", unit: "GeV" },
            ParamDef { key: "mass_down", label: "down quark mass", unit: "GeV" },
            ParamDef { key: "mass_charm", label: "charm quark mass", unit: "GeV" },
            ParamDef { key: "mass_strange", label: "strange quark mass", unit: "GeV" },
            ParamDef { key: "mass_top", label: "top quark mass", unit: "GeV" },
            ParamDef { key: "mass_bottom", label: "bottom quark mass", unit: "GeV" },
            ParamDef { key: "mass_electron", label: "electron mass", unit: "GeV" },
            ParamDef { key: "mass_muon", label: "muon mass", unit: "GeV" },
            ParamDef { key: "mass_tau", label: "tau mass", unit: "GeV" },
            ParamDef { key: "mass_nu_e", label: "electron neutrino mass", unit: "GeV" },
            ParamDef { key: "mass_nu_mu", label: "muon neutrino mass", unit: "GeV" },
            ParamDef { key: "mass_nu_tau", label: "tau neutrino mass", unit: "GeV" },
        ]
    }
    fn equations(&self) -> &'static [EqDef] {
        &[
            EqDef { id: "boltzmann_phi", title: "Inflaton decay", latex: r"\frac{d\rho_{\varphi}}{dt}=-3H\rho_{\varphi}-\Gamma_{\varphi}\rho_{\varphi}" },
            EqDef { id: "boltzmann_r", title: "Radiation from the decay", latex: r"\frac{d\rho_{r}}{dt}=-4H\rho_{r}+\Gamma_{\varphi}\rho_{\varphi}" },
            EqDef { id: "rho_t", title: "Temperature", latex: r"\rho_{r}=\frac{\pi^{2}}{30}g_{*}(T)\,T^{4}" },
        ]
    }
    fn rules(&self) -> &'static [Rule] {
        &[Rule { child: "nucleosynthesis", output: "T", above: 1.0e8, below: 1.0e10, cause: "T fell below 1e10 K", time_output: "" }]
    }
    fn evaluate(&self, t: f64, p: &BTreeMap<String, f64>) -> Outcome {
        let _g = params::activate(p.clone());
        let hand = cosmology::handoff();
        if t < hand.t {
            return Outcome { health: HEALTH_INACTIVE, reason: "not active at this time — inflation has not ended".into(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() };
        }
        let r = reheating::at_time(t);
        let mut outputs = BTreeMap::new();
        outputs.insert("T".into(), r.temperature);
        outputs.insert("rho_phi".into(), r.rho_phi);
        outputs.insert("rho_r".into(), r.rho_r);
        outputs.insert("a".into(), r.a);
        outputs.insert("H".into(), r.h);
        let bad = !r.temperature.is_finite() || r.rho_phi < 0.0 || r.rho_r < 0.0 || (r.active && r.a <= 0.0);
        let (health, reason) = if bad {
            (HEALTH_BAD, "a negative density or a non-finite temperature".into())
        } else {
            (HEALTH_OK, "decay equations".into())
        };
        let mut vars = vec![
            v("scale factor a", "", r.a),
            v("Hubble rate", "1/s", r.h),
            v("inflaton density", "J/m³", r.rho_phi),
            v("radiation density", "J/m³", r.rho_r),
            v("temperature", "K", r.temperature),
            v("reheating temperature (analytic)", "K", r.t_rh_analytic),
            v("reheating temperature (integrated)", "K", r.t_rh_integrated),
            v("g*", "", r.g_star),
            v("quark-hadron threshold", "", r.qcd_threshold),
        ];
        for s in &r.species {
            vars.push(v(&format!("{} number density", s.name), "1/m³", s.number_density));
            vars.push(v(&format!("{} energy density", s.name), "J/m³", s.energy_density));
        }
        let symbols = vec![
            sym("boltzmann_phi", "rho_phi", r"\rho_{\varphi}", "J/m³", r.rho_phi),
            sym("boltzmann_phi", "H", "H", "1/s", r.h),
            sym("boltzmann_phi", "Gamma", r"\Gamma_{\varphi}", "1/s", p.get("Gamma_phi").copied().unwrap_or(reheating::default_gamma())),
            sym("boltzmann_r", "rho_r", r"\rho_{r}", "J/m³", r.rho_r),
            sym("rho_t", "T", "T", "K", r.temperature),
            sym("rho_t", "g_star", "g_{*}", "", r.g_star),
        ];
        Outcome { health, reason, vars, symbols, outputs }
    }
}

impl Engine for Nucleosynthesis {
    fn id(&self) -> &'static str { "nucleosynthesis" }
    fn generates(&self) -> &'static str { "light-element abundances — not built" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/reheating.rs" }
    fn not_built(&self) -> bool { true }
    fn evaluate(&self, _t: f64, _p: &BTreeMap<String, f64>) -> Outcome {
        let mut outputs = BTreeMap::new();
        outputs.insert("built".into(), 0.0);
        Outcome {
            health: HEALTH_NOT_BUILT,
            reason: "NOT BUILT — the temperature is known, the nuclear network is not in this repo".into(),
            vars: vec![v("helium-4 mass fraction", "", 0.0), v("deuterium", "", 0.0)],
            symbols: vec![],
            outputs,
        }
    }
}

impl Engine for Planet {
    fn id(&self) -> &'static str { "planet" }
    fn generates(&self) -> &'static str { "a small planet grid: temperature, wind, rain, clouds" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/grid.rs" }
    fn parameters(&self) -> &'static [ParamDef] {
        &[
            ParamDef { key: "nlat", label: "grid rows", unit: "" },
            ParamDef { key: "nlon", label: "grid columns", unit: "" },
            ParamDef { key: "solar_constant", label: "solar constant", unit: "W/m²" },
            ParamDef { key: "obliquity_deg", label: "tilt", unit: "°" },
            ParamDef { key: "lapse_rate", label: "lapse rate", unit: "K/m" },
            ParamDef { key: "humidity_seed", label: "humidity seed", unit: "" },
            ParamDef { key: "water_albedo", label: "water albedo", unit: "" },
            ParamDef { key: "snow_albedo", label: "snow albedo", unit: "" },
        ]
    }
    fn equations(&self) -> &'static [EqDef] {
        &[EqDef { id: "budyko", title: "Budyko temperature", latex: r"T=\frac{(1-\alpha)Q-A+C\bar{T}}{B+C}" }]
    }
    fn rules(&self) -> &'static [Rule] {
        &[
            Rule { child: "climate", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
            Rule { child: "solar", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
            Rule { child: "energy", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
            Rule { child: "wind", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
            Rule { child: "hydro", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
            Rule { child: "clouds", output: "ready", above: 1.0, below: f64::INFINITY, cause: "the planet grid exists", time_output: "" },
        ]
    }
    fn evaluate(&self, t: f64, p: &BTreeMap<String, f64>) -> Outcome {
        let (day, hour) = cosmic_time::planet_clock(t);
        if !day.is_finite() {
            PLANET.with(|s| *s.borrow_mut() = None);
            return Outcome { health: HEALTH_INACTIVE, reason: "not active at this time — the planet has not formed".into(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() };
        }
        let nlat = p.get("nlat").copied().unwrap_or(8.0);
        let nlon = p.get("nlon").copied().unwrap_or(16.0);
        if nlat < 2.0 || nlon < 4.0 || nlat > 48.0 || nlon > 96.0 || nlat.fract() != 0.0 || nlon.fract() != 0.0 {
            PLANET.with(|s| *s.borrow_mut() = None);
            return Outcome { health: HEALTH_OUTSIDE, reason: format!("grid {nlat}×{nlon} is outside this evaluation (use a whole number from 2×4 up to 48×96); it was not replaced"), vars: vec![], symbols: vec![], outputs: BTreeMap::new() };
        }
        let _hold = params::activate(p.clone());
        let snap = crate::planet_eval::run(day, hour, nlat as usize, nlon as usize);
        let mean_t = snap.mean("ts");
        PLANET.with(|s| *s.borrow_mut() = Some(snap));
        let mut outputs = BTreeMap::new();
        outputs.insert("ready".into(), 1.0);
        outputs.insert("mean_temperature".into(), mean_t);
        let health = if mean_t.is_finite() { HEALTH_OK } else { HEALTH_BAD };
        let reason = if mean_t.is_finite() { "planet grid".into() } else { "the grid temperature is not a number".into() };
        Outcome {
            health,
            reason,
            vars: vec![v("rows", "", nlat), v("columns", "", nlon), v("day of year", "", day), v("hour", "h", hour), v("mean surface temperature", "°C", mean_t)],
            symbols: vec![
                sym("budyko", "T", "T", "°C", mean_t),
                sym("budyko", "alpha", r"\alpha", "", p.get("water_albedo").copied().unwrap_or(0.06)),
                sym("budyko", "Q", "Q", "W/m²", p.get("solar_constant").copied().unwrap_or(1361.0)),
                sym("budyko", "A", "A", "W/m²", 203.3),
                sym("budyko", "B", "B", "W/m²/K", 2.09),
                sym("budyko", "C", "C", "W/m²/K", 3.87),
            ],
            outputs,
        }
    }
}

impl Engine for Slice {
    fn id(&self) -> &'static str { "slice" }
    fn generates(&self) -> &'static str { "one part of the planet grid" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/planet_fundamentals/planet_update.rs" }
    fn evaluate(&self, _t: f64, _p: &BTreeMap<String, f64>) -> Outcome {
        Outcome { health: HEALTH_INACTIVE, reason: "internal".into(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() }
    }
}

fn slice_eval(id: &str, p: &BTreeMap<String, f64>) -> Outcome {
    let snap = PLANET.with(|s| s.borrow().clone());
    let Some(snap) = snap else {
        return Outcome { health: HEALTH_INACTIVE, reason: "not active at this time".into(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() };
    };
    let planes: &[(&str, &str, &str)] = match id {
        "climate" => &[("surface temperature", "°C", "ts"), ("air temperature", "°C", "tair"), ("humidity", "kg/kg", "q")],
        "solar" => &[("top-of-atmosphere sun", "W/m²", "toa"), ("shortwave down", "W/m²", "swdown"), ("absorbed", "W/m²", "qabs")],
        "energy" => &[("surface temperature", "°C", "ts"), ("evaporation", "mm/day", "evap"), ("outgoing longwave", "W/m²", "olr")],
        "wind" => &[("east wind", "m/s", "u"), ("north wind", "m/s", "v"), ("pressure", "Pa", "pressure")],
        "hydro" => &[("rain", "mm/day", "precip"), ("snow water", "mm", "snow"), ("soil water", "mm", "soil")],
        "clouds" => &[("cloud fraction", "", "cloud"), ("optical depth", "", "cot")],
        _ => &[],
    };
    let mut vars = Vec::new();
    let mut bad = false;
    for (label, unit, plane) in planes {
        if let Some(st) = snap.stat(plane) {
            if !st.mean.is_finite() { bad = true; }
            vars.push(Var { label: (*label).into(), unit: (*unit).into(), value: st.mean, min: st.min, max: st.max, n: st.n });
        }
    }
    let solar = p.get("solar_constant").copied().unwrap_or(1361.0);
    let mut symbols = vec![];
    match id {
        "climate" => {
            symbols.push(sym("budyko", "T", "T", "°C", snap.mean("ts")));
            symbols.push(sym("budyko", "Q", "Q", "W/m²", solar));
            symbols.push(sym("budyko", "alpha", r"\alpha", "", p.get("water_albedo").copied().unwrap_or(0.06)));
        }
        "solar" => {
            symbols.push(sym("insolation", "S0", "S_{0}", "W/m²", solar));
            symbols.push(sym("insolation", "toa", "Q", "W/m²", snap.mean("toa")));
        }
        "energy" => {
            symbols.push(sym("surface", "T", "T_{s}", "°C", snap.mean("ts")));
            symbols.push(sym("surface", "E", "E", "mm/day", snap.mean("evap")));
        }
        "wind" => {
            if let Some(st) = snap.stat("u") {
                symbols.push(sym("geostrophic", "u", "u", "m/s", st.mean));
            }
            symbols.push(sym("geostrophic", "f", "f", "1/s", 2.0 * 7.292115e-5));
        }
        "hydro" => {
            symbols.push(sym("bucket", "P", "P", "mm/day", snap.mean("precip")));
            symbols.push(sym("bucket", "W", "W", "mm", snap.mean("soil")));
        }
        "clouds" => {
            symbols.push(sym("sundqvist", "C", "C", "", snap.mean("cloud")));
            symbols.push(sym("sundqvist", "RH", "RH_{c}", "", 0.75));
        }
        _ => {}
    }
    let (health, reason) = if bad { (HEALTH_BAD, "a grid value is not a number".into()) } else { (HEALTH_OK, "grid summary".into()) };
    Outcome { health, reason, vars, symbols, outputs: BTreeMap::new() }
}

thread_local! {
    static PLANET: RefCell<Option<crate::planet_eval::Snap>> = const { RefCell::new(None) };
    static SUPPRESS: Cell<u32> = const { Cell::new(0) };
    static NOW_MS: Cell<f64> = const { Cell::new(0.0) };
    static REG: RefCell<Registry> = RefCell::new(Registry::new());
}

/// Browser clock, milliseconds. `Instant` is not available in wasm32-unknown-unknown.
pub fn set_now(ms: f64) { if ms.is_finite() && ms >= 0.0 { NOW_MS.with(|n| n.set(ms)); } }
pub fn now_ms() -> f64 { NOW_MS.with(|n| n.get()) }

pub struct Suppress;
pub fn suppress() -> Suppress {
    SUPPRESS.with(|s| s.set(s.get() + 1));
    Suppress
}
impl Drop for Suppress {
    fn drop(&mut self) { SUPPRESS.with(|s| s.set(s.get().saturating_sub(1))); }
}

#[derive(Clone)]
struct Session {
    calls: u64,
    first_ms: f64,
    last_ms: f64,
    day: f64,
    hour: f64,
    vars: Vec<Var>,
}

struct Instance {
    uid: u64,
    type_id: String,
    parent: Option<u64>,
    parent_type: String,
    cause: String,
    spawned_at: f64,
    born_ms: f64,
    manual: bool,
    outcome: Outcome,
}

struct LogEntry {
    kind: &'static str,
    t: f64,
    cause: String,
    parent: String,
    child: String,
}

pub struct Registry {
    next_uid: u64,
    cycle: f64,
    fresh: bool,
    params: BTreeMap<String, f64>,
    instances: Vec<Instance>,
    log: Vec<LogEntry>,
    session: BTreeMap<String, Session>,
}

impl Registry {
    fn new() -> Self {
        Self { next_uid: 1, cycle: cosmic_time::seconds_to_cycle(13.8e9 * YEAR_S), fresh: false, params: BTreeMap::new(), instances: vec![], log: vec![], session: BTreeMap::new() }
    }
}

fn engine_for<'a>(id: &str) -> Option<&'a dyn Engine> {
    match id {
        "spacetime" => Some(&Spacetime),
        "reheating" => Some(&ReheatingEng),
        "nucleosynthesis" => Some(&Nucleosynthesis),
        "planet" => Some(&Planet),
        "climate" | "solar" | "energy" | "wind" | "hydro" | "clouds" => Some(&Slice),
        _ => None,
    }
}

fn generates(id: &str) -> &'static str {
    match id {
        "spacetime" => Spacetime.generates(),
        "reheating" => ReheatingEng.generates(),
        "nucleosynthesis" => Nucleosynthesis.generates(),
        "planet" => Planet.generates(),
        "climate" => "air temperature, soil water, snow and humidity",
        "solar" => "sunlight at the top of the atmosphere and at the ground",
        "energy" => "surface temperature and evaporation",
        "wind" => "wind and pressure",
        "hydro" => "rain, snow and soil water",
        "clouds" => "cloud cover",
        _ => "",
    }
}

fn file_of(id: &str) -> &'static str {
    match id {
        "spacetime" => "rust/boreal-sim/src/cosmology.rs",
        "reheating" => "rust/boreal-sim/src/reheating.rs",
        "nucleosynthesis" => "rust/boreal-sim/src/reheating.rs",
        "climate" => "rust/boreal-sim/src/planet_fundamentals/climate_seed.rs",
        "solar" => "rust/boreal-sim/src/planet_fundamentals/energy/solar_budget.rs",
        "energy" => "rust/boreal-sim/src/planet_fundamentals/energy/energy_update.rs",
        "wind" => "rust/boreal-sim/src/planet_fundamentals/atmosphere/wind.rs",
        "hydro" => "rust/boreal-sim/src/planet_fundamentals/hydrosphere/precipitation.rs",
        "clouds" => "rust/boreal-sim/src/planet_fundamentals/atmosphere/cloud_fraction.rs",
        _ => "rust/boreal-sim/src/grid.rs",
    }
}

fn rules_of(id: &str) -> &'static [Rule] {
    match id {
        "spacetime" => Spacetime.rules(),
        "reheating" => ReheatingEng.rules(),
        "planet" => Planet.rules(),
        _ => &[],
    }
}

fn eval_id(id: &str, t: f64, p: &BTreeMap<String, f64>) -> Outcome {
    match id {
        "spacetime" => Spacetime.evaluate(t, p),
        "reheating" => ReheatingEng.evaluate(t, p),
        "nucleosynthesis" => Nucleosynthesis.evaluate(t, p),
        "planet" => Planet.evaluate(t, p),
        "climate" | "solar" | "energy" | "wind" | "hydro" | "clouds" => slice_eval(id, p),
        _ => Outcome { health: HEALTH_BAD, reason: "unknown engine".into(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() },
    }
}

struct Wanted {
    type_id: &'static str,
    parent_type: String,
    cause: String,
    at: f64,
}

fn wanted(t: f64, p: &BTreeMap<String, f64>) -> Vec<Wanted> {
    if !t.is_finite() {
        return vec![];
    }
    // The root is always there so a negative or zero time can say so itself.
    let mut order = vec!["spacetime"];
    let mut out = vec![Wanted { type_id: "spacetime", parent_type: String::new(), cause: "root".into(), at: t }];
    let mut guard = 0;
    while guard < 12 {
        guard += 1;
        let mut grew = false;
        let parents: Vec<&str> = order.clone();
        for parent in parents {
            let ev = eval_id(parent, t, p);
            for rule in rules_of(parent) {
                let value = ev.outputs.get(rule.output).copied().unwrap_or(f64::NAN);
                if value >= rule.above && value < rule.below && !order.contains(&rule.child) {
                    let at = if rule.time_output.is_empty() { t } else { ev.outputs.get(rule.time_output).copied().unwrap_or(t) };
                    order.push(rule.child);
                    out.push(Wanted { type_id: rule.child, parent_type: parent.into(), cause: rule.cause.into(), at });
                    grew = true;
                }
            }
        }
        if !grew { break; }
    }
    out
}

impl Registry {
    fn reconcile(&mut self) {
        let t = cosmic_time::cycle_to_seconds(self.cycle);
        let want = wanted(t, &self.params);
        let want_ids: BTreeSet<&str> = want.iter().map(|w| w.type_id).collect();
        let mut i = 0;
        while i < self.instances.len() {
            if self.instances[i].manual {
                i += 1;
                continue;
            }
            if !want_ids.contains(self.instances[i].type_id.as_str()) {
                let inst = self.instances.remove(i);
                self.log.push(LogEntry { kind: "despawn", t, cause: "the time moved off its threshold".into(), parent: inst.parent_type, child: inst.type_id });
            } else {
                i += 1;
            }
        }
        // Orphans: a manual or auto whose parent type is gone.
        let alive: BTreeSet<String> = self.instances.iter().map(|n| n.type_id.clone()).collect();
        let mut i = 0;
        while i < self.instances.len() {
            let orphan = !self.instances[i].parent_type.is_empty() && !alive.contains(&self.instances[i].parent_type);
            if orphan {
                let inst = self.instances.remove(i);
                self.log.push(LogEntry { kind: "despawn", t, cause: "parent despawned".into(), parent: inst.parent_type, child: inst.type_id });
            } else {
                i += 1;
            }
        }
        for w in &want {
            if self.instances.iter().any(|n| !n.manual && n.type_id == w.type_id) {
                continue;
            }
            let parent = self.instances.iter().find(|n| n.type_id == w.parent_type).map(|n| n.uid);
            self.spawn_engine(w.type_id, parent, &w.parent_type, &w.cause, w.at, false);
        }
        // Refresh outcomes in dependency order.
        let ids: Vec<String> = self.instances.iter().map(|n| n.type_id.clone()).collect();
        for id in ids {
            let outcome = eval_id(&id, t, &self.params);
            self.count_eval(&id);
            if let Some(inst) = self.instances.iter_mut().find(|n| n.type_id == id) {
                inst.outcome = outcome;
            }
        }
    }

    fn count_eval(&mut self, id: &str) {
        if SUPPRESS.with(|s| s.get() > 0) {
            return;
        }
        let now = now_ms();
        let e = self.session.entry(id.into()).or_insert(Session { calls: 0, first_ms: 0.0, last_ms: 0.0, day: 0.0, hour: 0.0, vars: vec![] });
        e.calls += 1;
        if e.first_ms == 0.0 { e.first_ms = now; }
    }

    fn spawn_engine(&mut self, type_id: &str, parent: Option<u64>, parent_type: &str, cause: &str, at: f64, manual: bool) -> Option<u64> {
        if engine_for(type_id).is_none() && !matches!(type_id, "climate" | "solar" | "energy" | "wind" | "hydro" | "clouds") {
            return None;
        }
        let uid = self.next_uid;
        self.next_uid += 1;
        let t = cosmic_time::cycle_to_seconds(self.cycle);
        self.log.push(LogEntry { kind: "spawn", t: at, cause: cause.into(), parent: parent_type.into(), child: type_id.into() });
        self.instances.push(Instance {
            uid,
            type_id: type_id.into(),
            parent,
            parent_type: parent_type.into(),
            cause: cause.into(),
            spawned_at: at,
            born_ms: now_ms(),
            manual,
            outcome: Outcome { health: HEALTH_IDLE, reason: String::new(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() },
        });
        let _ = t;
        Some(uid)
    }
}

fn default_of(key: &str) -> f64 {
    match key {
        "G" => cosmology::G,
        "c" => cosmology::C,
        "hbar" => cosmology::HBAR,
        "k_B" => cosmology::K_B,
        "Lambda" => cosmology::default_lambda(),
        "k" => 0.0,
        "H0" => cosmology::H0_KM,
        "omega_m" => cosmology::OMEGA_M,
        "omega_lambda" => cosmology::OMEGA_L,
        "omega_r" => cosmology::OMEGA_R,
        "inflaton_mass" => cosmology::default_mass_planck(),
        "phi0" => cosmology::default_phi(),
        "phi_dot0" => cosmology::default_phi_dot(),
        "Gamma_inflation" => cosmology::default_mass_planck() * 1e-3,
        "T_cmb" => cosmology::T_CMB,
        "Gamma_phi" => reheating::default_gamma(),
        "g_star" => 0.0,
        "qcd_transition" => 1.0,
        "qcd_MeV" => 150.0,
        "mass_photon" => 0.0,
        "mass_gluon" => 0.0,
        "mass_W" => 80.377,
        "mass_Z" => 91.1876,
        "mass_Higgs" => 125.20,
        "mass_up" => 0.00216,
        "mass_down" => 0.00467,
        "mass_charm" => 1.27,
        "mass_strange" => 0.0934,
        "mass_top" => 172.57,
        "mass_bottom" => 4.183,
        "mass_electron" => 0.000510999,
        "mass_muon" => 0.105658,
        "mass_tau" => 1.77686,
        "mass_nu_e" => 0.0,
        "mass_nu_mu" => 0.0,
        "mass_nu_tau" => 0.0,
        "nlat" => 8.0,
        "nlon" => 16.0,
        "solar_constant" => 1361.0,
        "obliquity_deg" => 23.439291,
        "lapse_rate" => 0.0065,
        "humidity_seed" => 0.75,
        "water_albedo" => 0.06,
        "snow_albedo" => 0.80,
        _ => f64::NAN,
    }
}

pub fn note(id: &str, started_ms: f64, day: f64, hour: f64, vars: &[Var]) {
    if SUPPRESS.with(|s| s.get() > 0) {
        return;
    }
    REG.with(|r| {
        let mut g = r.borrow_mut();
        let e = g.session.entry(id.into()).or_insert(Session { calls: 0, first_ms: 0.0, last_ms: 0.0, day: 0.0, hour: 0.0, vars: vec![] });
        e.calls += 1;
        let now = now_ms();
        if e.first_ms == 0.0 { e.first_ms = if started_ms > 0.0 { started_ms } else { now }; }
        e.last_ms = if started_ms > 0.0 && now >= started_ms { now - started_ms } else { 0.0 };
        e.day = day;
        e.hour = hour;
        if !vars.is_empty() { e.vars = vars.to_vec(); }
    });
}

pub fn set_cycle(cycle: f64) {
    REG.with(|r| {
        let mut g = r.borrow_mut();
        if g.fresh && g.cycle.to_bits() == cycle.to_bits() { return; }
        g.cycle = cycle;
        g.fresh = true;
        g.reconcile();
    });
}

pub fn set_param(key: &str, value: f64) -> bool {
    if default_of(key).is_nan() && !key.starts_with("mass_") {
        return false;
    }
    REG.with(|r| {
        let mut g = r.borrow_mut();
        g.params.insert(key.into(), value);
        g.fresh = true;
        g.reconcile();
    });
    true
}

pub fn reset_all() {
    REG.with(|r| {
        let mut g = r.borrow_mut();
        g.params.clear();
        g.fresh = true;
        g.reconcile();
    });
}

pub fn reset_engine(id: &str) {
    let keys: Vec<String> = match id {
        "spacetime" => Spacetime.parameters().iter().map(|p| p.key.into()).collect(),
        "reheating" => ReheatingEng.parameters().iter().map(|p| p.key.into()).collect(),
        "planet" | "climate" | "solar" | "energy" | "wind" | "hydro" | "clouds" => Planet.parameters().iter().map(|p| p.key.into()).collect(),
        _ => vec![],
    };
    REG.with(|r| {
        let mut g = r.borrow_mut();
        for k in keys { g.params.remove(&k); }
        g.fresh = true;
        g.reconcile();
    });
}

pub fn manual_spawn(type_id: &str) -> bool {
    REG.with(|r| {
        let mut g = r.borrow_mut();
        if engine_for(type_id).is_none() && find(type_id).is_none() {
            return false;
        }
        let t = cosmic_time::cycle_to_seconds(g.cycle);
        g.spawn_engine(type_id, None, "", "manual", t, true).is_some()
    })
}

pub fn manual_despawn(type_id: &str) -> bool {
    REG.with(|r| {
        let mut g = r.borrow_mut();
        if let Some(i) = g.instances.iter().position(|n| n.manual && n.type_id == type_id) {
            let inst = g.instances.remove(i);
            let t = cosmic_time::cycle_to_seconds(g.cycle);
            g.log.push(LogEntry { kind: "despawn", t, cause: "manual".into(), parent: inst.parent_type, child: inst.type_id });
            true
        } else {
            false
        }
    })
}

fn hms(secs: f64) -> String {
    if !secs.is_finite() || secs < 0.0 { return "00:00:00".into(); }
    let s = secs.floor() as u64;
    format!("{:02}:{:02}:{:02}", s / 3600, (s / 60) % 60, s % 60)
}

pub fn report() -> String {
    REG.with(|r| {
        let mut g = r.borrow_mut();
        if !g.fresh {
            g.reconcile();
            g.fresh = true;
        }
        let t = cosmic_time::cycle_to_seconds(g.cycle);
        let mut lines = Vec::new();
        lines.push("v3".into());
        lines.push(format!("TIME\t{}\t{}\t{}\t{}", g.cycle, t, cosmic_time::seconds_to_years(t), cosmic_time::era_of_seconds(t)));
        for inst in &g.instances {
            let online = (now_ms() - inst.born_ms).max(0.0) / 1000.0;
            let parent = inst.parent.unwrap_or(0);
            lines.push(format!(
                "INST\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}\t{}",
                inst.uid, inst.type_id, parent, clean(&inst.parent_type), clean(&inst.cause), inst.spawned_at, hms(online),
                inst.outcome.health, clean(&inst.outcome.reason), crate::engine_born::born(file_of(&inst.type_id)), clean(generates(&inst.type_id))
            ));
            for var in &inst.outcome.vars {
                lines.push(format!("VAR\t{}\t{}\t{}\t{}\t{}\t{}\t{}", inst.uid, clean(&var.label), clean(&var.unit), var.value, var.min, var.max, var.n));
            }
            for sym in &inst.outcome.symbols {
                lines.push(format!("SYM\t{}\t{}\t{}\t{}\t{}\t{}", inst.uid, clean(&sym.equation), clean(&sym.name), clean(&sym.latex), clean(&sym.unit), sym.value));
            }
        }
        for id in ["spacetime", "reheating", "planet"] {
            let eng: &dyn Engine = match id {
                "spacetime" => &Spacetime,
                "reheating" => &ReheatingEng,
                _ => &Planet,
            };
            for par in eng.parameters() {
                let value = g.params.get(par.key).copied().unwrap_or_else(|| default_of(par.key));
                lines.push(format!("PAR\t{id}\t{}\t{}\t{}\t{}\t{}", par.key, clean(par.label), clean(par.unit), value, default_of(par.key)));
            }
            for eq in eng.equations() {
                lines.push(format!("EQ\t{id}\t{}\t{}\t{}", eq.id, clean(eq.title), clean(eq.latex)));
            }
            for rule in eng.rules() {
                lines.push(format!("RULE\t{id}\t{}\t{}\t{}", rule.child, rule.output, clean(rule.cause)));
            }
        }
        lines.push("EQ\tclimate\tbudyko\tBudyko temperature\tT=\\frac{(1-\\alpha)Q-A+C\\bar{T}}{B+C}".into());
        lines.push("EQ\tsolar\tinsolation\tInsolation\tQ=S_{0}\\,\\mu_{0}".into());
        lines.push("EQ\tenergy\tsurface\tSurface energy\tC\\frac{dT_{s}}{dt}=R_{n}-\\lambda E-H".into());
        lines.push("EQ\twind\tgeostrophic\tGeostrophic wind\tu=-(1/(\\rho f))\\partial p/\\partial y".into());
        lines.push("EQ\thydro\tbucket\tSoil bucket\t\\frac{dW}{dt}=P-E".into());
        lines.push("EQ\tclouds\tsundqvist\tCloud fraction\tC=1-\\sqrt{(1-RH)/(1-RH_{c})}".into());
        for entry in &g.log {
            lines.push(format!("LOG\t{}\t{}\t{}\t{}\t{}", entry.kind, entry.t, clean(&entry.cause), clean(&entry.parent), clean(&entry.child)));
        }
        for (id, s) in &g.session {
            let online = if s.first_ms > 0.0 { (now_ms() - s.first_ms).max(0.0) / 1000.0 } else { 0.0 };
            lines.push(format!("SESS\t{id}\t{}\t{}\t{}\t{}\t{}", s.calls, hms(online), s.last_ms, s.day, s.hour));
            for var in &s.vars {
                lines.push(format!("SVAR\t{id}\t{}\t{}\t{}\t{}\t{}\t{}", clean(&var.label), clean(&var.unit), var.value, var.min, var.max, var.n));
            }
        }
        lines.join("\n")
    })
}

fn clean(s: &str) -> String {
    s.replace(['\t', '\n', '\r'], " ")
}

pub fn types() -> &'static [&'static str] {
    &["spacetime", "reheating", "nucleosynthesis", "planet", "climate", "solar", "energy", "wind", "hydro", "clouds"]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fresh() -> Registry { Registry::new() }

    #[test]
    fn manual_spawn_and_despawn() {
        let mut r = fresh();
        r.cycle = 1.0;
        let uid = r.spawn_engine("reheating", None, "", "manual", 1.0, true);
        assert!(uid.is_some());
        assert!(r.instances.iter().any(|n| n.type_id == "reheating" && n.manual));
        r.instances.retain(|n| !(n.manual && n.type_id == "reheating"));
        assert!(!r.instances.iter().any(|n| n.type_id == "reheating"));
    }

    #[test]
    fn reheating_spawns_after_inflation_and_not_at_the_planck_time() {
        let mut r = fresh();
        r.cycle = 1.0;
        r.reconcile();
        assert!(r.instances.iter().any(|n| n.type_id == "spacetime"));
        assert!(!r.instances.iter().any(|n| n.type_id == "reheating"));
        let end = cosmology::handoff().t;
        r.cycle = cosmic_time::seconds_to_cycle(end * 2.0);
        r.reconcile();
        let re = r.instances.iter().find(|n| n.type_id == "reheating").expect("reheating");
        assert_eq!(re.parent_type, "spacetime");
        assert!(re.cause.contains('ε') || re.cause.contains("eps") || re.cause.contains('='), "{}", re.cause);
        assert!((re.spawned_at - end).abs() / end < 1e-6, "spawned at {} end {}", re.spawned_at, end);
    }

    #[test]
    fn nucleosynthesis_fires_in_its_temperature_window() {
        let mut r = fresh();
        r.cycle = cosmic_time::seconds_to_cycle(100.0);
        r.reconcile();
        assert!(r.instances.iter().any(|n| n.type_id == "nucleosynthesis"), "T at 100 s should be inside 1e8..1e10");
        let n = r.instances.iter().find(|n| n.type_id == "nucleosynthesis").unwrap();
        assert_eq!(n.parent_type, "reheating");
        assert_eq!(n.outcome.health, HEALTH_NOT_BUILT);
        r.cycle = 1.0;
        r.reconcile();
        assert!(!r.instances.iter().any(|n| n.type_id == "nucleosynthesis"));
        assert!(!r.instances.iter().any(|n| n.type_id == "reheating"));
    }

    #[test]
    fn scrubbing_is_deterministic_and_leaves_no_orphans() {
        let mut r = fresh();
        let go = |r: &mut Registry, c: f64| { r.cycle = c; r.reconcile(); };
        go(&mut r, cosmic_time::seconds_to_cycle(100.0));
        let once: BTreeSet<_> = r.instances.iter().map(|n| (n.type_id.clone(), n.parent_type.clone())).collect();
        go(&mut r, 1.0);
        go(&mut r, cosmic_time::seconds_to_cycle(100.0));
        let twice: BTreeSet<_> = r.instances.iter().map(|n| (n.type_id.clone(), n.parent_type.clone())).collect();
        assert_eq!(once, twice);
        let types: BTreeSet<_> = r.instances.iter().map(|n| n.type_id.clone()).collect();
        for n in &r.instances {
            if !n.parent_type.is_empty() {
                assert!(types.contains(&n.parent_type), "orphan {}", n.type_id);
            }
        }
    }

    #[test]
    fn children_follow_the_parent() {
        let mut r = fresh();
        r.cycle = cosmic_time::seconds_to_cycle(100.0);
        r.reconcile();
        let ids: Vec<_> = r.instances.iter().map(|n| n.type_id.as_str()).collect();
        let s = ids.iter().position(|id| *id == "spacetime").unwrap();
        let h = ids.iter().position(|id| *id == "reheating").unwrap();
        let n = ids.iter().position(|id| *id == "nucleosynthesis").unwrap();
        assert!(s < h && h < n, "{ids:?}");
    }

    #[test]
    fn every_standard_model_mass_is_editable() {
        let text = report();
        for key in ["mass_photon", "mass_gluon", "mass_W", "mass_Z", "mass_Higgs", "mass_up", "mass_down", "mass_charm", "mass_strange", "mass_top", "mass_bottom", "mass_electron", "mass_muon", "mass_tau", "mass_nu_e", "mass_nu_mu", "mass_nu_tau"] {
            assert!(text.contains(key), "missing {key}");
            assert!(set_param(key, 0.5), "{key}");
        }
        assert!(report().contains("mass_muon"));
        reset_all();
    }
}
