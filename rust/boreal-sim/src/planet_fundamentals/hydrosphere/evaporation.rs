//! Penman–Monteith evaporation split from `hydrosphere_budget.rs` (T-0062, issue #46).
//! Port of `surfaceBalance` in weather.ts (Monteith 1965; FAO-56).
use crate::consts::*;
use crate::planet_fundamentals::energy::longwave::atmospheric_emissivity;
use super::humidity_column::esat;

#[derive(Clone, Copy, Debug)]
pub struct Balance { pub rn: f64, pub g: f64, pub le: f64, pub h: f64, pub evap: f64, pub ra: f64, pub rho: f64 }

/// Surface energy balance of one column, W/m² (port of `surfaceBalance`, weather.ts): Rn = (1−α)S↓ + (ε_a − ε_s)σT⁴ (Brutsaert 1975;
/// Crawford & Duchon 1999), G = 0.1 Rn by day / 0.5 by night (FAO-56 eq. 45–46), λE from Penman–Monteith (Monteith 1965; FAO-56 eq. 3)
/// limited by bucket wetness β on land, H = residual. `water` columns are never water-limited.
pub fn surface_balance(albedo: f64, rs: f64, z0: f64, water: bool, sw: f64, t_c: f64, q: f64, p: f64, wind: f64, cloud: f64, beta: f64) -> Balance {
    let t = t_c + 273.15;
    let e = q * p / 0.622 / 100.0; // hPa
    let ea = atmospheric_emissivity(e * 100.0, t, cloud);
    let lnet = (ea - EMISS_SURFACE) * SIGMA * t.powi(4);
    let rn = (1.0 - albedo) * sw + lnet;
    let g = rn * if sw > 0.0 { 0.1 } else { 0.5 };
    let ra = (10.0 / z0).ln().powi(2) / (KAPPA * KAPPA * wind.max(0.5)); // neutral aerodynamic resistance (FAO-56 eq. 4, simplified)
    let d = 4098.0 * esat(t_c) / (t_c + 237.3).powi(2);
    let vpd = (esat(t_c) - e * 100.0).max(0.0);
    let rho = p / (RD * t);
    let le = ((d * (rn - g) + rho * CP * vpd / ra) / (d + GAMMA_PSY * (1.0 + rs / ra))).max(0.0) * if water { 1.0 } else { beta };
    Balance { rn, g, le, h: rn - g - le, evap: le / LV, ra, rho }
}

#[cfg(test)]
mod tests {
    use super::*;
    // Golden values from weather.ts under tsx: surfaceBalance('forest', 600, 20, .010, 100000, 4, .3, .7) and ('water', 400, 15, .008, 101000, 6, .5, 1).
    #[test] fn matches_typescript_forest() {
        let b = surface_balance(0.1, 100.0, 1.5, false, 600.0, 20.0, 0.010, 100000.0, 4.0, 0.3, 0.7);
        assert!((b.rn - 495.3243258817769).abs() < 1e-6, "{}", b.rn);
        assert!((b.le - 109.33662067719023).abs() < 1e-6, "{}", b.le);
        assert!((b.h - 336.45527261640893).abs() < 1e-6);
    }
    #[test] fn matches_typescript_water() {
        let b = surface_balance(0.06, 0.0, 0.0002, true, 400.0, 15.0, 0.008, 101000.0, 6.0, 0.5, 1.0);
        assert!((b.rn - 344.0246781280627).abs() < 1e-6, "{}", b.rn);
        assert!((b.le - 217.0474876899853).abs() < 1e-6);
    }
}
