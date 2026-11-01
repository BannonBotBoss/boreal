//! Ground cover rows for the viewer (issue #167, grokbot-1, Rust lane #158).
//! Per landing (lat, lon) with the planet sample's elevation, vegetation weight and water flag, returns a cover class,
//! stems per hectare and a billboard height. Deterministic: the same place returns the same row.
//! Class comes from temperature (altitude-zones.json, the same physics as src/core/altitudeZones.ts) and the vegetation
//! weight. Densities and heights are labelled calibration ranges in data/earth/cover-density.json [verify].

pub const ZONES_JSON: &str = include_str!("../../../data/earth/altitude-zones.json");
pub const COVER_JSON: &str = include_str!("../../../data/earth/cover-density.json");

/// Class ids in the order the wasm export writes them.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cover { Water = 0, Ice = 1, Rock = 2, Tundra = 3, Desert = 4, Prairie = 5, Boreal = 6, Tropical = 7 }
impl Cover {
    pub fn name(self) -> &'static str { ["water", "ice", "rock", "tundra", "desert", "prairie", "boreal", "tropical"][self as usize] }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CoverRow { pub class: Cover, pub stems_per_ha: f64, pub height_m: f64 }

/// Tiny reader for a top-level `"key": number` in the bundled JSON (no serde dependency).
fn num(src: &str, key: &str) -> f64 {
    let k = format!("\"{key}\"");
    let i = src.find(&k).unwrap_or_else(|| panic!("missing {key}")) + k.len();
    let rest = src[i..].trim_start().trim_start_matches(':').trim_start();
    let end = rest.find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == 'e' || c == 'E' || c == '+')).unwrap_or(rest.len());
    rest[..end].parse().unwrap_or_else(|_| panic!("bad number for {key}"))
}
/// `"class": { "field": [a, b] }` from cover-density.json.
fn range(class: &str, field: &str) -> (f64, f64) {
    let k = format!("\"{class}\":");
    // Skip the `_sources` text entry with the same key: take the occurrence whose value is an object.
    let start = COVER_JSON.match_indices(&k).map(|(i, _)| i)
        .find(|&i| COVER_JSON[i + k.len()..].trim_start().starts_with('{'))
        .unwrap_or_else(|| panic!("missing {class}"));
    let block = &COVER_JSON[start..start + COVER_JSON[start..].find('}').unwrap()];
    let f = format!("\"{field}\"");
    let i = block.find(&f).unwrap() + f.len();
    let a = &block[i..];
    let (o, c) = (a.find('[').unwrap(), a.find(']').unwrap());
    let v: Vec<f64> = a[o + 1..c].split(',').map(|s| s.trim().parse().unwrap()).collect();
    (v[0], v[1])
}

/// Mean of the warm half of the year at sea level (C), North 1975 + North & Coakley 1979 (altitude-zones.json).
pub fn sea_level_warm_c(lat_deg: f64) -> f64 {
    let x = lat_deg.to_radians().sin();
    num(ZONES_JSON, "T0_C") + num(ZONES_JSON, "T2_C") * (3.0 * x * x - 1.0) / 2.0
        + 2.0 / std::f64::consts::PI * num(ZONES_JSON, "seasonal_half_range_pole_K") * x.abs()
}
/// Height where trees stop (m a.s.l.), Koerner & Paulsen 2004. Matches treeLineM in TypeScript.
pub fn tree_line_m(lat_deg: f64) -> f64 { ((sea_level_warm_c(lat_deg) - num(ZONES_JSON, "tree_line_growing_season_C")) / num(ZONES_JSON, "lapse_K_per_m")).max(0.0) }
/// Height above which ice never melts (m a.s.l.). Matches iceLineM in TypeScript.
pub fn ice_line_m(lat_deg: f64) -> f64 { ((sea_level_warm_c(lat_deg) - num(ZONES_JSON, "ice_line_warm_season_C")) / num(ZONES_JSON, "lapse_K_per_m")).max(0.0) }

/// Annual mean at the site (C): North 1975 sea-level mean minus the lapse rate times height (no seasonal term).
pub fn site_mean_c(lat_deg: f64, elev_m: f64) -> f64 {
    let x = lat_deg.to_radians().sin();
    num(ZONES_JSON, "T0_C") + num(ZONES_JSON, "T2_C") * (3.0 * x * x - 1.0) / 2.0 - num(ZONES_JSON, "lapse_K_per_m") * elev_m.max(0.0)
}

/// Deterministic 0..1 from a place (splitmix64 on quantised lat/lon, ~1 m).
pub fn place_hash(lat: f64, lon: f64) -> f64 {
    let a = (lat * 1e5).round() as i64 as u64;
    let b = (lon * 1e5).round() as i64 as u64;
    let mut z = a.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ b.rotate_left(29) ^ 0xB0E3_A1u64;
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z >> 11) as f64 / (1u64 << 53) as f64
}

/// Cover class from causes. `vegetation` is the planet sample's 0..1 weight.
pub fn cover_class(lat_deg: f64, elev_m: f64, vegetation: f64, water: bool) -> Cover {
    if water { return Cover::Water; }
    let lat = lat_deg.abs();
    let elev = elev_m.max(0.0);
    if elev >= ice_line_m(lat) { return Cover::Ice; }
    let tree = tree_line_m(lat);
    if elev > tree {
        // Arctic lowland (tree line at or near sea level) is tundra; a mountain above its tree line is bare rock.
        return if tree < 80.0 && elev < tree + 300.0 { Cover::Tundra } else { Cover::Rock };
    }
    if vegetation < num(COVER_JSON, "veg_desert_below") { Cover::Desert }
    else if vegetation < num(COVER_JSON, "veg_prairie_below") { Cover::Prairie }
    else if site_mean_c(lat_deg, elev) >= num(COVER_JSON, "tropical_mean_C") { Cover::Tropical }
    else { Cover::Boreal }
}

/// The full row the viewer asked for in #167.
pub fn cover_row(lat_deg: f64, lon_deg: f64, elev_m: f64, vegetation: f64, water: bool) -> CoverRow {
    let class = cover_class(lat_deg, elev_m, vegetation, water);
    let h = place_hash(lat_deg, lon_deg);
    let h2 = place_hash(lon_deg, lat_deg);
    let (stems, height) = match class {
        Cover::Water | Cover::Ice | Cover::Rock => (0.0, 0.0),
        c => {
            let (s0, s1) = range(c.name(), "stems_per_ha");
            let (t0, t1) = range(c.name(), "height_m");
            // Wetter sites sit higher in their range; the hash spreads neighbours apart.
            let v = (0.5 * vegetation.clamp(0.0, 1.0) + 0.5 * h).clamp(0.0, 1.0);
            ((s0 + (s1 - s0) * v).round(), t0 + (t1 - t0) * (0.5 * v + 0.5 * h2))
        }
    };
    CoverRow { class, stems_per_ha: stems, height_m: height }
}

/// Metres between billboards for a density: one plant per spacing² m² (10,000 m² per hectare). None for zero.
pub fn spacing_m(stems_per_ha: f64) -> Option<f64> { if stems_per_ha > 0.0 { Some((10_000.0 / stems_per_ha).sqrt()) } else { None } }

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn same_place_same_row() {
        assert_eq!(cover_row(49.8, -94.5, 350.0, 0.8, false), cover_row(49.8, -94.5, 350.0, 0.8, false));
    }
    #[test] fn neighbours_differ() {
        assert_ne!(cover_row(49.8, -94.5, 350.0, 0.8, false).stems_per_ha, cover_row(49.81, -94.5, 350.0, 0.8, false).stems_per_ha);
    }
    #[test] fn water_ice_rock_have_no_plants() {
        assert_eq!(cover_row(10.0, 0.0, 0.0, 1.0, true).class, Cover::Water);
        assert_eq!(cover_row(80.0, 0.0, 10.0, 0.5, false).class, Cover::Ice);
        let r = cover_row(46.5, 8.0, 3200.0, 0.9, false); // Alps above the tree line
        assert!(matches!(r.class, Cover::Rock | Cover::Ice));
        assert_eq!(r.stems_per_ha, 0.0);
    }
    #[test] fn arctic_lowland_is_tundra() { assert_eq!(cover_class(68.0, 50.0, 0.4, false), Cover::Tundra); }
    #[test] fn boreal_prairie_desert_by_moisture() {
        assert_eq!(cover_class(50.0, 300.0, 0.8, false), Cover::Boreal);
        assert_eq!(cover_class(50.0, 600.0, 0.45, false), Cover::Prairie);
        assert_eq!(cover_class(25.0, 500.0, 0.1, false), Cover::Desert);
    }
    #[test] fn warm_wet_lowland_is_tropical() {
        assert_eq!(cover_class(-3.0, 50.0, 0.95, false), Cover::Tropical); // Amazon
        assert_eq!(cover_class(-3.0, 3000.0, 0.95, false), Cover::Boreal); // Andes cloud forest height cools it
        assert_eq!(cover_class(10.0, 300.0, 0.45, false), Cover::Prairie); // dry tropics stay savanna/prairie
    }
    #[test] fn tree_line_matches_typescript_formula() {
        // TypeScript treeLineM(0) with T0 14.97, T2 -28, 6.4 C, 6.5 K/km: (14.97 + 14 - 6.4) / 0.0065.
        assert!((tree_line_m(0.0) - (14.97 + 14.0 - 6.4) / 0.0065).abs() < 1e-6);
    }
    #[test] fn boreal_density_inside_range_and_spacing_sane() {
        let r = cover_row(55.0, -100.0, 300.0, 0.9, false);
        assert!(r.stems_per_ha >= 1000.0 && r.stems_per_ha <= 3000.0);
        let s = spacing_m(r.stems_per_ha).unwrap();
        assert!(s > 1.5 && s < 3.5, "{s}");
    }
}
