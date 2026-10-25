//! Surface energy update (issue #43): C dTs/dt = Rn(Ts) − λE − H, H = ρ cp (Ts − Ta) / ra (bulk aerodynamic exchange, Monin–Obukhov neutral
//! form as in weather.ts). Air temperature is the climatological field of `climate_seed` (a pure function of day and latitude, PROJECT-RULES 8),
//! as `climate()` is in weather.ts; it is not integrated, because without radiative cooling of the air column a sensible-heat-driven air
//! temperature runs away (first version: 40 °C mid-latitude land after 20 days).
//! Moved from `update_energy.rs` (T-0062).
use crate::consts::*;
use crate::grid::*;
use crate::planet_fundamentals::atmosphere::{surface_pressure, vertical_instability};
use crate::planet_fundamentals::climate_seed::{OLR_A, OLR_B};
use crate::planet_fundamentals::hydrosphere::{ice_fraction_subgrid, surface_balance};
use super::solar_budget::{budget, solar};
use crate::planet_fundamentals::surface::{beta, cell_surface};

pub const SUBSTEP_S: f64 = 600.0;

pub fn update_energy(g: &mut Grid, dt: f64) {
    let n = g.n;
    g.refresh_rows();
    let mut left = dt;
    while left > 1e-9 {
        let h = left.min(SUBSTEP_S);
        let utc = (g.hour + (dt - left) / 3600.0) % 24.0;
        for i in 0..n {
            let (lat, lon, land, elev) = (g.p(LAT)[i], g.p(LON)[i], g.p(LAND)[i], g.p(ELEV)[i]);
            let r = i / g.nlon;
            let ta = (if land < 0.5 { g.row_sea[r] } else { g.row_land[r] }) - LAPSE * elev.max(0.0) * land;
            g.pm(TAIR)[i] = ta;
            let (ts, soil, swe, q, cloud, ice) = (g.p(TS)[i], g.p(SOIL)[i], g.p(SNOW)[i], g.p(Q)[i], g.p(CLOUD)[i], g.p(ICE)[i]);
            let cs = cell_surface(land, soil, swe, ice);
            let sun = solar(g.day, utc, lat, lon, 0.0);
            // column budget (column_budget.rs): surface shortwave after ozone, Rayleigh, aerosol, cloud and water-vapour losses; fed to the
            // surface balance as the equivalent incident flux (its (1 - albedo) x sw then equals the column's surface absorption)
            let col = crate::column_budget::column(sun.toa, sun.cos_z, cloud, g.p(COT)[i], g.p(PW)[i], cs.albedo);
            let sw = if cs.albedo < 1.0 { col.abs_surf / (1.0 - cs.albedo) } else { 0.0 };
            let p = surface_pressure(P0, elev.max(0.0), ta);
            let wind = (g.p(U)[i].hypot(g.p(V)[i])).max(2.0);
            let b = surface_balance(cs.albedo, cs.rs, cs.z0, land < 0.5, sw, ts, q, p, wind, cloud, beta(soil));
            let hb = b.rho * CP * (ts - ta) / b.ra;
            let new_ts = ts + h * (b.rn - b.le - hb) / cs.heatcap;
            g.pm(TS)[i] = new_ts.clamp(-90.0, 70.0);
            g.pm(ICE)[i] = if land < 0.5 { ice_fraction_subgrid(new_ts, std::f64::consts::PI * 6371.0 / g.nlat as f64) } else { 0.0 };
            if land < 0.5 { g.pm(SST)[i] = new_ts; }
            // diagnostics at the last substep
            if left <= SUBSTEP_S + 1e-9 {
                let sb = budget(&sun, cloud, cs.albedo, ts, q * p / 0.622);
                g.pm(QABS)[i] = sb.q_absorbed; g.pm(QREFL)[i] = sb.q_reflected; g.pm(LWOUT)[i] = sb.q_longwave_out; g.pm(LWNET)[i] = sb.lw_net;
                g.pm(SWDOWN)[i] = sb.sw_down; g.pm(REFLSW)[i] = col.refl_atm + col.refl_surf; g.pm(ABSATM)[i] = col.abs_atm;
                g.pm(OLR)[i] = OLR_A + OLR_B * ts; g.pm(TOA)[i] = sb.toa; g.pm(ALBEDO)[i] = cs.albedo; g.pm(HEATCAP)[i] = cs.heatcap;
                g.pm(ROUGH)[i] = cs.z0; g.pm(SNOWFRAC)[i] = cs.snow; g.pm(SEAFRAC)[i] = cs.sea_fraction;
                g.pm(EVAP)[i] = b.evap * 86400.0; // mm/day (1 kg/m² = 1 mm)
                g.pm(INSTAB)[i] = vertical_instability(ts, ta);
                g.pm(PRESSURE)[i] = p;
            }
        }
        left -= h;
    }
}
