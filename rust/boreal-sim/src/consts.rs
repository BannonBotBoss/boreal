//! Constants shared by every budget. Values are ported from `src/core/weather.ts` (AIR, SURFACE, HYDRO) and
//! `src/core/tuning.ts` (PHYS) so TypeScript and Rust agree; the citation comments are the TypeScript ones.
//! A value from memory or derived carries `[verify]`; pure game calibration says so (PROJECT-RULES 5 and 7).

use crate::constants as C;

pub const S0: f64 = C::TSI; // total solar irradiance, W/m² (Kopp & Lean 2011, GRL 38:L01706)
pub const SIGMA: f64 = C::sigma; // Stefan–Boltzmann, W/m²/K⁴ (CODATA 2018)
pub const CP: f64 = 1004.0; // dry air cp, J/kg/K (Wallace & Hobbs 2006, Atmospheric Science, 2nd ed.)
pub const RV: f64 = 461.5; // gas constant water vapour, J/kg/K (Wallace & Hobbs 2006)
pub const RD: f64 = 287.05; // gas constant dry air, J/kg/K (Wallace & Hobbs 2006)
pub const LV: f64 = 2.501e6; // latent heat of vaporisation at 0 °C, J/kg (Wallace & Hobbs 2006)
pub const P0: f64 = 101325.0; // sea-level standard pressure, Pa (ISO 2533:1975)
pub const LAPSE: f64 = 0.0065; // environmental lapse rate, K/m (ICAO/ISO 2533)
pub const KAPPA: f64 = 0.41; // von Kármán constant (Högström 1996, Bound.-Layer Meteor. 78:215)
pub const OMEGA: f64 = C::omega_earth; // Earth rotation rate, rad/s (IERS Conventions 2010)
pub const GAMMA_PSY: f64 = 66.5; // psychrometric constant at ~100 kPa, Pa/K (Allen et al. 1998, FAO-56 Table 2.2) [verify]
pub const G_CONST: f64 = C::G; // gravitational constant (constants.rs, CODATA 2018, locked)
pub const EARTH_MASS: f64 = C::M_earth; // kg = GM_earth/G (constants.rs)
pub const EARTH_RADIUS: f64 = C::R_earth_mean; // m, IUGG R1 (constants.rs)
/// g = G·M/r², the same route as proc/physics `gravity()`; there is no literal 9.8 (PROJECT-RULES 4).
pub fn gravity() -> f64 { G_CONST * EARTH_MASS / (EARTH_RADIUS * EARTH_RADIUS) }
pub const RHO_WATER: f64 = 1000.0; // kg/m³
pub const BUCKET_MM: f64 = 150.0; // bucket field capacity (Manabe 1969, Mon. Weather Rev. 97:739)
pub const DDF: f64 = 3.0; // degree-day melt factor, mm w.e./°C/day (Hock 2003, J. Hydrol. 282:104) [verify]
pub const SEA_ICE_T: f64 = -1.8; // freezing point of sea water at S≈33–35, °C (UNESCO 1983 / Millero 1978) [verify]
pub const EMISS_SURFACE: f64 = 0.98; // surface emissivity used by `surfaceBalance` in weather.ts
