//! Animal density per landing (grokbot-1, Rust lane #158; first two species from the #159 3D request).
//! Built on the #167 cover row: an animal lives only where its range and its cover class allow it.
//! Densities are labelled calibration ranges in data/earth/species-density.json [verify]. Deterministic per (lat, lon, year).

use crate::cover::{cover_row, place_hash, Cover};

pub const SPECIES_JSON: &str = include_str!("../../../data/earth/species-density.json");

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Species { SnowshoeHare = 0, WhiteTailedDeer = 1, Moose = 2, CanadaLynx = 3, GrayWolf = 4, Caribou = 5, AmericanBlackBear = 6, GrizzlyBear = 7, BaldEagle = 8, Beaver = 9, RedFox = 10 }
impl Species {
    pub fn key(self) -> &'static str { ["snowshoe_hare", "white_tailed_deer", "moose", "canada_lynx", "gray_wolf", "caribou", "american_black_bear", "grizzly_bear", "bald_eagle", "beaver", "red_fox"][self as usize] }
    pub fn from_id(id: u32) -> Option<Self> { match id { 0 => Some(Self::SnowshoeHare), 1 => Some(Self::WhiteTailedDeer), 2 => Some(Self::Moose), 3 => Some(Self::CanadaLynx), 4 => Some(Self::GrayWolf), 5 => Some(Self::Caribou), 6 => Some(Self::AmericanBlackBear), 7 => Some(Self::GrizzlyBear), 8 => Some(Self::BaldEagle), 9 => Some(Self::Beaver), 10 => Some(Self::RedFox), _ => None } }
}

fn block(sp: Species) -> &'static str {
    let k = format!("\"{}\":", sp.key());
    let start = SPECIES_JSON.match_indices(&k).map(|(i, _)| i)
        .find(|&i| SPECIES_JSON[i + k.len()..].trim_start().starts_with('{')).expect("species block");
    &SPECIES_JSON[start..start + SPECIES_JSON[start..].find('}').unwrap()]
}
fn has_field(sp: Species, f: &str) -> bool { block(sp).contains(&format!("\"{f}\"")) }
fn field(sp: Species, f: &str) -> Vec<f64> {
    let b = block(sp);
    let k = format!("\"{f}\"");
    let a = &b[b.find(&k).unwrap_or_else(|| panic!("missing {f}")) + k.len()..];
    let a = a.trim_start().trim_start_matches(':').trim_start();
    if let Some(r) = a.strip_prefix('[') {
        r[..r.find(']').unwrap()].split(',').map(|s| s.trim().parse().unwrap()).collect()
    } else {
        let end = a.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-')).unwrap_or(a.len());
        vec![a[..end].parse().unwrap()]
    }
}

/// Is (lat, lon) inside the species' range box?
pub fn in_range(sp: Species, lat: f64, lon: f64) -> bool {
    let (la, lo) = (field(sp, "lat"), field(sp, "lon"));
    lat >= la[0] && lat <= la[1] && lon >= lo[0] && lon <= lo[1]
}

/// Animals per hectare at a landing in a given year. Zero outside the range or on cover the species cannot use.
pub fn density_per_ha(sp: Species, lat: f64, lon: f64, elev_m: f64, vegetation: f64, water: bool, year: i32) -> f64 {
    if !in_range(sp, lat, lon) { return 0.0; }
    let cls = cover_row(lat, lon, elev_m, vegetation, water).class;
    let key = match cls { Cover::Boreal => "boreal_per_ha", Cover::Prairie => "prairie_per_ha", Cover::Desert => "desert_per_ha", Cover::Tundra => "tundra_per_ha", _ => return 0.0 };
    if !has_field(sp, key) { return 0.0; } // tundra is opt-in: only species that list it live there
    let r = field(sp, key);
    if r[1] <= 0.0 { return 0.0; }
    let h = place_hash(lat + 0.5 * sp as u32 as f64, lon);
    let cycle = field(sp, "cycle_years")[0];
    let v = if cycle > 0.0 {
        // Population cycle: the phase shifts slowly with place so neighbouring valleys peak in step, the far range does not.
        // A predator on the same cycle runs `cycle_lag_years` behind its prey (lynx behind hare).
        let lag = if has_field(sp, "cycle_lag_years") { field(sp, "cycle_lag_years")[0] } else { 0.0 };
        let phase = (year as f64 - lag + 3.0 * place_hash(lat.round(), lon.round())) / cycle;
        let wave = 0.5 - 0.5 * (std::f64::consts::TAU * phase).cos();
        (0.8 * wave * wave + 0.2 * h).clamp(0.0, 1.0)
    } else { h };
    r[0] + (r[1] - r[0]) * v
}

/// Whole animals to spawn in a square patch of `side_m` metres, rounded deterministically from the density.
pub fn spawn_count(density_per_ha: f64, side_m: f64, lat: f64, lon: f64) -> u32 {
    let expected = density_per_ha * side_m * side_m / 10_000.0;
    let f = expected.floor();
    (f + if place_hash(lon, lat + 7.0) < expected - f { 1.0 } else { 0.0 }) as u32
}

pub const ALL: [Species; 11] = [Species::SnowshoeHare, Species::WhiteTailedDeer, Species::Moose, Species::CanadaLynx, Species::GrayWolf, Species::Caribou,
    Species::AmericanBlackBear, Species::GrizzlyBear, Species::BaldEagle, Species::Beaver, Species::RedFox];

/// The local population list for one landing: (species, whole animals) for every species with at least one animal in a
/// square patch `side_m` wide, in species-id order. This is what the bridge sends so the viewer can show the full cast.
pub fn landing_population(lat: f64, lon: f64, elev_m: f64, vegetation: f64, water: bool, year: i32, side_m: f64) -> Vec<(Species, u32)> {
    ALL.iter().filter_map(|&sp| {
        let d = density_per_ha(sp, lat, lon, elev_m, vegetation, water, year);
        // Offset the rounding hash per species so two species at the same density do not round together.
        let n = spawn_count(d, side_m, lat + 0.25 * sp as u32 as f64, lon);
        (n > 0).then_some((sp, n))
    }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn same_place_same_year_same_density() {
        let a = density_per_ha(Species::SnowshoeHare, 54.0, -120.0, 200.0, 0.8, false, 2026);
        assert_eq!(a, density_per_ha(Species::SnowshoeHare, 54.0, -120.0, 200.0, 0.8, false, 2026));
        assert!(a >= 0.1 && a <= 6.0, "{a}");
    }
    #[test] fn hare_cycles_over_a_decade() {
        let ds: Vec<f64> = (2020..2030).map(|y| density_per_ha(Species::SnowshoeHare, 55.0, -100.0, 300.0, 0.9, false, y)).collect();
        let (lo, hi) = ds.iter().fold((f64::MAX, 0.0f64), |(l, h), &d| (l.min(d), h.max(d)));
        assert!(hi > 3.0 * lo, "{lo} {hi}");
    }
    #[test] fn no_hares_on_prairie_or_outside_range() {
        assert_eq!(density_per_ha(Species::SnowshoeHare, 50.0, -105.0, 600.0, 0.45, false, 2026), 0.0);
        assert_eq!(density_per_ha(Species::SnowshoeHare, 60.0, 25.0, 100.0, 0.9, false, 2026), 0.0); // Finland: other hares
    }
    #[test] fn deer_denser_on_prairie_edge_than_boreal_and_none_on_water() {
        let p = density_per_ha(Species::WhiteTailedDeer, 45.0, -95.0, 300.0, 0.5, false, 2026);
        let b = density_per_ha(Species::WhiteTailedDeer, 50.0, -90.0, 350.0, 0.9, false, 2026);
        assert!(p > b, "{p} {b}");
        assert_eq!(density_per_ha(Species::WhiteTailedDeer, 45.0, -95.0, 0.0, 1.0, true, 2026), 0.0);
    }
    #[test] fn lynx_peaks_about_two_years_after_hares() {
        let peak = |sp| (2020..2030).max_by(|&a, &b| density_per_ha(sp, 55.0, -100.0, 300.0, 0.9, false, a)
            .partial_cmp(&density_per_ha(sp, 55.0, -100.0, 300.0, 0.9, false, b)).unwrap()).unwrap();
        let lag = (peak(Species::CanadaLynx) - peak(Species::SnowshoeHare)).rem_euclid(10);
        assert!((1..=3).contains(&lag), "lag {lag}");
    }
    #[test] fn moose_in_boreal_not_desert_and_scarcer_than_hares() {
        let m = density_per_ha(Species::Moose, 55.0, -100.0, 300.0, 0.9, false, 2026);
        assert!(m > 0.0 && m < 0.02, "{m}");
        assert_eq!(density_per_ha(Species::Moose, 25.0, -110.0, 900.0, 0.1, false, 2026), 0.0);
        assert_eq!(Species::from_id(3), Some(Species::CanadaLynx));
    }
    #[test] fn caribou_on_tundra_and_wolves_scarcer_than_their_prey() {
        let c = density_per_ha(Species::Caribou, 68.0, -110.0, 50.0, 0.4, false, 2026);
        assert!(c > 0.0, "caribou on tundra {c}");
        assert_eq!(density_per_ha(Species::SnowshoeHare, 68.0, -110.0, 50.0, 0.4, false, 2026), 0.0);
        let w = density_per_ha(Species::GrayWolf, 55.0, -100.0, 300.0, 0.9, false, 2026);
        let m = density_per_ha(Species::Moose, 55.0, -100.0, 300.0, 0.9, false, 2026);
        assert!(w > 0.0 && w < m, "wolf {w} moose {m}");
        assert!(density_per_ha(Species::GrayWolf, 68.0, -110.0, 50.0, 0.4, false, 2026) > 0.0, "wolves follow caribou onto tundra");
        assert_eq!(density_per_ha(Species::Caribou, 25.0, -110.0, 900.0, 0.1, false, 2026), 0.0);
        assert_eq!(Species::from_id(5), Some(Species::Caribou));
    }
    #[test] fn landing_population_lists_boreal_cast_and_nothing_on_water() {
        let pop = landing_population(55.0, -100.0, 300.0, 0.9, false, 2026, 5_000.0);
        let ids: Vec<u32> = pop.iter().map(|&(s, _)| s as u32).collect();
        assert!(ids.contains(&0) && ids.contains(&2), "hare and moose in a 25 km2 boreal patch: {ids:?}");
        assert!(ids.windows(2).all(|w| w[0] < w[1]));
        assert!(pop.iter().all(|&(_, n)| n > 0));
        assert_eq!(pop, landing_population(55.0, -100.0, 300.0, 0.9, false, 2026, 5_000.0));
        assert!(landing_population(45.0, -95.0, 0.0, 1.0, true, 2026, 5_000.0).is_empty());
    }
    #[test] fn bears_black_widespread_grizzly_west_only() {
        let b = density_per_ha(Species::AmericanBlackBear, 55.0, -100.0, 300.0, 0.9, false, 2026);
        let m = density_per_ha(Species::Moose, 55.0, -100.0, 300.0, 0.9, false, 2026);
        assert!(b > 0.0 && b < 0.02, "black bear {b} (moose {m})");
        assert_eq!(density_per_ha(Species::AmericanBlackBear, 68.0, -110.0, 50.0, 0.4, false, 2026), 0.0, "no black bears on tundra");
        let g = density_per_ha(Species::GrizzlyBear, 55.0, -120.0, 300.0, 0.9, false, 2026);
        assert!(g > 0.0 && g < b, "grizzly {g} scarcer than black bear {b}");
        assert!(density_per_ha(Species::GrizzlyBear, 68.0, -110.0, 50.0, 0.4, false, 2026) > 0.0, "barren-ground grizzlies");
        assert_eq!(density_per_ha(Species::GrizzlyBear, 50.0, -75.0, 300.0, 0.9, false, 2026), 0.0, "none in Quebec");
        assert_eq!(Species::from_id(7), Some(Species::GrizzlyBear));
        assert_eq!(Species::from_id(11), None);
    }
    #[test] fn bald_eagles_in_forest_scarce_on_prairie_none_on_tundra() {
        let e = density_per_ha(Species::BaldEagle, 55.0, -100.0, 300.0, 0.9, false, 2026);
        let p = density_per_ha(Species::BaldEagle, 50.0, -105.0, 600.0, 0.45, false, 2026);
        assert!(e > 0.0 && e <= 0.002, "eagle in boreal {e}");
        assert!(p >= 0.0 && p <= 0.0003, "eagle on prairie {p}");
        assert_eq!(density_per_ha(Species::BaldEagle, 68.0, -110.0, 50.0, 0.4, false, 2026), 0.0, "no eagles on open tundra");
        assert_eq!(density_per_ha(Species::BaldEagle, 60.0, 25.0, 100.0, 0.9, false, 2026), 0.0, "Finland: white-tailed eagle, not bald");
        assert_eq!(Species::from_id(8), Some(Species::BaldEagle));
    }
    #[test] fn beavers_in_forest_thin_on_prairie_none_on_tundra() {
        let f = density_per_ha(Species::Beaver, 55.0, -100.0, 300.0, 0.9, false, 2026);
        let p = density_per_ha(Species::Beaver, 50.0, -105.0, 600.0, 0.45, false, 2026);
        assert!(f > 0.0 && f <= 0.05, "beaver in boreal {f}");
        assert!(p >= 0.0 && p <= 0.01, "beaver on prairie {p}");
        assert_eq!(density_per_ha(Species::Beaver, 72.0, -110.0, 50.0, 0.4, false, 2026), 0.0, "none on the high Arctic tundra");
        assert_eq!(density_per_ha(Species::Beaver, 60.0, 25.0, 100.0, 0.9, false, 2026), 0.0, "Finland: Eurasian beaver, not this table");
        assert_eq!(Species::from_id(9), Some(Species::Beaver));
    }
    #[test] fn red_foxes_in_forest_and_prairie_and_low_arctic() {
        let f = density_per_ha(Species::RedFox, 55.0, -100.0, 300.0, 0.9, false, 2026);
        let p = density_per_ha(Species::RedFox, 50.0, -105.0, 600.0, 0.45, false, 2026);
        assert!(f > 0.0 && f <= 0.01, "red fox in boreal {f}");
        assert!(p <= 0.02, "red fox on prairie {p}");
        assert!(density_per_ha(Species::RedFox, 68.0, -110.0, 50.0, 0.4, false, 2026) > 0.0, "low-Arctic tundra foxes");
        assert_eq!(density_per_ha(Species::RedFox, 60.0, 25.0, 100.0, 0.9, false, 2026), 0.0, "Finland: not this North American table");
        assert_eq!(Species::from_id(10), Some(Species::RedFox));
    }
    #[test] fn spawn_count_tracks_density() {
        assert_eq!(spawn_count(0.0, 500.0, 50.0, -90.0), 0);
        let n = spawn_count(2.0, 100.0, 50.0, -90.0); // 2/ha over 1 ha
        assert!(n == 2 || n == 3);
    }
}
