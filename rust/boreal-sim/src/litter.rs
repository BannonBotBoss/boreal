//! A gray wolf litter (Mech & Boitani 2003, Wolves, reproduction chapter).
//!
//! The common litter is 4–6. This step uses 5, the middle of that range.
//! Pups stay in the den for about three weeks and can walk after that
//! (Packard, in the same volume). They are born at the den at four weeks,
//! old enough to follow, and the follow step walks them into the trail
//! behind their mother. The trail stays near her, inside the chase view.

/// Pups in one litter. The middle of the common 4–6 range.
pub const LITTER_COUNT: u32 = 5;
/// Four weeks, in years. They can leave the den and walk.
pub const EMERGE_YEARS: f64 = 4.0 / 52.0;
/// How fast a four-week pup walks, metres per second. A yearling is quicker.
pub const PUP_SPEED_M_S: f64 = 0.9;
/// Metres behind the mother at four weeks. A yearling walks closer.
/// Close enough that the 3.6 m chase camera, 1.05 m up, still looks at them.
const TRAIL_YOUNG_M: f64 = 0.75;
const TRAIL_YEAR_M: f64 = 0.45;
/// Game seconds of the world clock for one year of pup growth.
/// The default clock is 300 real seconds per game hour, so ten real minutes
/// are 7200 game seconds. That is half a year of growth (14400 s per year),
/// enough for the size, the step and the trail to change in one sitting.
pub const GROWTH_GAME_S_PER_YEAR: f64 = 14_400.0;
const DEN_RING_M: f64 = 1.2;
const TRAIL_GAP_M: f64 = 0.06;
/// Beside her. The outer pair stays inside a 48° frame from 3.6 m back.
const LATERAL_M: f64 = 0.85;
/// Closer than this and the pup is under the lens.
const VIEW_BACK_M: f64 = 1.15;
/// Further than this in one step is a drop, not a walk. The pup is on the trail at once.
const REJOIN_M: f64 = 4.0;

fn growth_u(age_years: f64) -> f64 {
    (age_years.max(0.0) / 1.0).min(1.0)
}

/// Age after `game_seconds` of the world clock. Rewind does not make them younger.
pub fn age_after(age_years: f64, game_seconds: f64) -> f64 {
    if !(game_seconds > 0.0) {
        return age_years;
    }
    age_years + game_seconds / GROWTH_GAME_S_PER_YEAR
}

/// Draw scale next to an adult. Four weeks is about a third. One year is full size.
pub fn body_scale(age_years: f64) -> f64 {
    let grown = growth_u(age_years);
    0.28 + 0.72 * grown
}

/// Metres behind the mother, before the slot gap. Older pups walk closer.
pub fn trail_back_m(age_years: f64) -> f64 {
    let u = growth_u(age_years);
    TRAIL_YOUNG_M * (1.0 - u) + TRAIL_YEAR_M * u
}

/// Walking speed. Four weeks is `PUP_SPEED_M_S`. A yearling is quicker.
pub fn walk_mps(age_years: f64) -> f64 {
    let u = growth_u(age_years);
    PUP_SPEED_M_S * (1.0 - u) + 1.6 * u
}

/// Stride cycles per second. A young pup takes short quick steps. A yearling takes longer ones.
pub fn step_hz(age_years: f64) -> f64 {
    let u = growth_u(age_years);
    2.6 * (1.0 - u) + 1.3 * u
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PupPlace {
    pub slot: u32,
    pub x: f64,
    pub z: f64,
    pub age_years: f64,
}

/// Five pups on a ring around the den. Slot 0 is east of the den.
pub fn birth_places(den_x: f64, den_z: f64) -> [PupPlace; LITTER_COUNT as usize] {
    let mut out = [PupPlace { slot: 0, x: den_x, z: den_z, age_years: EMERGE_YEARS }; LITTER_COUNT as usize];
    for slot in 0..LITTER_COUNT {
        let a = slot as f64 / LITTER_COUNT as f64 * std::f64::consts::TAU;
        out[slot as usize] = PupPlace {
            slot,
            x: den_x + a.cos() * DEN_RING_M,
            z: den_z + a.sin() * DEN_RING_M,
            age_years: EMERGE_YEARS,
        };
    }
    out
}

/// The point in the trail behind the mother. Forward is (−sin yaw, −cos yaw).
pub fn trail_slot(slot: u32, mother_x: f64, mother_z: f64, yaw: f64, age_years: f64) -> (f64, f64) {
    let back = (trail_back_m(age_years) + slot as f64 * TRAIL_GAP_M).min(VIEW_BACK_M);
    let side = (slot as f64 - (LITTER_COUNT as f64 - 1.0) / 2.0) * LATERAL_M;
    let fx = -yaw.sin();
    let fz = -yaw.cos();
    let rx = yaw.cos();
    let rz = -yaw.sin();
    (mother_x - fx * back + rx * side, mother_z - fz * back + rz * side)
}

/// One follow step. The pup walks toward its trail slot and does not overshoot it.
pub fn follow_step(x: f64, z: f64, slot: u32, mother_x: f64, mother_z: f64, yaw: f64, dt: f64, age_years: f64) -> (f64, f64) {
    let (tx, tz) = trail_slot(slot, mother_x, mother_z, yaw, age_years);
    let dx = tx - x;
    let dz = tz - z;
    let d = (dx * dx + dz * dz).sqrt();
    if d < 1e-6 || dt <= 0.0 {
        return (x, z);
    }
    if d > REJOIN_M {
        return (tx, tz);
    }
    let step = (walk_mps(age_years) * dt).min(d);
    (x + dx / d * step, z + dz / d * step)
}

/// Past the trail, not yet the rejoin. A short separation.
pub const VOICE_BRIEF_M: f64 = 2.2;
/// Same gap as the rejoin. She has left this pup behind.
pub const VOICE_FAR_M: f64 = REJOIN_M;

/// The sound for one pup this step.
/// A nudge of her paw is a huff. Far behind is a call. Hungry, tired, or a short
/// gap is a whimper. Following or playing (under half a year and still near her) is a yip.
pub fn pup_voice(dist_m: f64, moving: bool, age_years: f64, hungry: bool, tired: bool, nudged: bool) -> Option<&'static str> {
    if nudged { return Some("huff"); }
    if dist_m >= VOICE_FAR_M { return Some("call"); }
    if hungry || tired || dist_m >= VOICE_BRIEF_M { return Some("whimper"); }
    if moving || age_years < 0.5 { return Some("yip"); }
    None
}

/// Playback rate before a small random wobble. Four weeks is higher. A year is 1.
pub fn pup_pitch(age_years: f64) -> f64 {
    let u = age_years.clamp(0.0, 1.0);
    1.22 + (1.0 - 1.22) * u
}

/// The mother's litter, stored as her offspring. They are not founders.
/// Their territory is hers. They stand on the den ring.
pub fn birth_litter(world: &mut hecs::World, mother: &crate::animals::AnimalView, den_x: f64, den_z: f64) -> Vec<crate::animals::AnimalView> {
    birth_places(den_x, den_z)
        .into_iter()
        .map(|p| crate::animals::spawn_animal(world, crate::animals::SpawnAnimal {
            species: crate::animals::SPECIES_WOLF,
            archetype: crate::animals::ARCHETYPE_CANID,
            x: p.x,
            y: mother.y,
            z: p.z,
            age_years: p.age_years,
            water: mother.water,
            energy: mother.energy,
            rest: mother.rest,
            parent: mother.handle,
            founder: false,
            territory_holder: mother.territory,
            territory_x: mother.territory_x,
            territory_z: mother.territory_z,
        }))
        .collect()
}

/// `pup` under half a year, `juvenile` under one year, then `adult`.
pub fn growth_stage(age_years: f64) -> &'static str {
    if age_years < 0.5 { "pup" } else if age_years < 1.0 { "juvenile" } else { "adult" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn five_pups_are_born_on_the_den_and_can_walk() {
        let born = birth_places(21.5, 8.5);
        assert_eq!(born.len(), 5);
        assert_eq!(growth_stage(EMERGE_YEARS), "pup");
        for pup in born {
            let d = ((pup.x - 21.5).powi(2) + (pup.z - 8.5).powi(2)).sqrt();
            assert!((d - DEN_RING_M).abs() < 1e-9, "{d}");
            assert!((pup.age_years - EMERGE_YEARS).abs() < 1e-12);
        }
    }

    #[test]
    fn the_store_records_them_as_her_offspring() {
        let mut world = hecs::World::new();
        let pack = crate::animals::spawn_pack(&mut world, crate::animals::PackSpawn {
            species: crate::animals::SPECIES_WOLF,
            archetype: crate::animals::ARCHETYPE_CANID,
            count: 1,
            age_years: 2.0,
            spacing_m: 5.0,
            x: 30.0,
            y: 0.0,
            z: 0.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
        });
        let mother = pack[0];
        let pups = birth_litter(&mut world, &mother, 21.5, 8.5);
        assert_eq!(pups.len(), 5);
        for pup in pups {
            assert!(!pup.founder);
            assert_eq!(pup.parent, mother.handle);
            assert_eq!(pup.territory, mother.handle);
            assert_eq!(pup.species, crate::animals::SPECIES_WOLF);
            assert!((pup.age_years - EMERGE_YEARS).abs() < 1e-12);
        }
    }

    #[test]
    fn a_pup_walks_toward_the_trail_and_stops_on_it() {
        let (x, z) = follow_step(0.0, 0.0, 0, 0.0, 0.0, 0.0, 1.0, EMERGE_YEARS);
        let (tx, tz) = trail_slot(0, 0.0, 0.0, 0.0, EMERGE_YEARS);
        let before = (tx * tx + tz * tz).sqrt();
        let after = ((tx - x).powi(2) + (tz - z).powi(2)).sqrt();
        assert!(after < before - 0.5, "moved toward the slot");
        let (sx, sz) = follow_step(tx, tz, 0, 0.0, 0.0, 0.0, 1.0, EMERGE_YEARS);
        assert!((sx - tx).abs() < 1e-9 && (sz - tz).abs() < 1e-9);
    }

    #[test]
    fn ten_real_minutes_at_the_default_clock_grows_them() {
        // 300 real seconds per game hour, so 600 real seconds is 7200 game seconds.
        let ten_min = 7200.0;
        let older = age_after(EMERGE_YEARS, ten_min);
        assert!((older - (EMERGE_YEARS + 0.5)).abs() < 1e-9);
        assert!(body_scale(older) > body_scale(EMERGE_YEARS) + 0.3);
        assert!(trail_back_m(older) < trail_back_m(EMERGE_YEARS));
        assert!(walk_mps(older) > walk_mps(EMERGE_YEARS));
        assert!(step_hz(older) < step_hz(EMERGE_YEARS));
        assert_eq!(age_after(older, -100.0), older);
    }

    #[test]
    fn pups_stay_in_front_of_the_chase_camera() {
        let mut beside = 0;
        for slot in 0..LITTER_COUNT {
            let (x, z) = trail_slot(slot, 0.0, 0.0, 0.0, EMERGE_YEARS);
            assert!(z < 1.2 && z > 0.3, "slot {slot} is under the lens or in front at {z}");
            if x.abs() > 0.9 { beside += 1; }
        }
        assert!(beside >= 2);
    }

    #[test]
    fn a_pup_yips_near_her_and_calls_when_left_behind() {
        assert_eq!(pup_voice(1.0, true, EMERGE_YEARS, false, false, false), Some("yip"));
        assert_eq!(pup_voice(1.0, false, EMERGE_YEARS, false, false, false), Some("yip"));
        assert_eq!(pup_voice(1.0, false, 1.2, false, false, false), None);
        assert_eq!(pup_voice(3.0, true, EMERGE_YEARS, false, false, false), Some("whimper"));
        assert_eq!(pup_voice(1.0, true, EMERGE_YEARS, true, false, false), Some("whimper"));
        assert_eq!(pup_voice(1.0, true, EMERGE_YEARS, false, true, false), Some("whimper"));
        assert_eq!(pup_voice(VOICE_FAR_M, false, EMERGE_YEARS, false, false, false), Some("call"));
        assert_eq!(pup_voice(1.0, false, 1.2, false, false, true), Some("huff"));
        assert!(pup_pitch(EMERGE_YEARS) > pup_pitch(1.0));
        assert!((pup_pitch(1.0) - 1.0).abs() < 1e-9);
    }

    #[test]
    fn a_drop_puts_the_litter_back_on_the_trail() {
        let (x, z) = follow_step(0.0, 0.0, 1, 40.0, -12.0, -0.4, 0.05, EMERGE_YEARS);
        let (tx, tz) = trail_slot(1, 40.0, -12.0, -0.4, EMERGE_YEARS);
        assert!((x - tx).abs() < 1e-9 && (z - tz).abs() < 1e-9);
    }
}
