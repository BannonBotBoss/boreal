//! A gray wolf litter (Mech & Boitani 2003, Wolves, reproduction chapter).
//!
//! The common litter is 4–6. This step uses 5, the middle of that range.
//! Pups stay in the den for about three weeks and can walk after that
//! (Packard, in the same volume). They are born at the den at four weeks,
//! old enough to follow, and the follow step walks them into the trail
//! behind their mother. Nothing here is placed for a camera.

/// Pups in one litter. The middle of the common 4–6 range.
pub const LITTER_COUNT: u32 = 5;
/// Four weeks, in years. They can leave the den and walk.
pub const EMERGE_YEARS: f64 = 4.0 / 52.0;
/// How fast a pup of that age walks, metres per second.
pub const PUP_SPEED_M_S: f64 = 0.9;
const DEN_RING_M: f64 = 1.2;
const TRAIL_M: f64 = 1.6;
const TRAIL_GAP_M: f64 = 0.7;
const LATERAL_M: f64 = 0.45;

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
pub fn trail_slot(slot: u32, mother_x: f64, mother_z: f64, yaw: f64) -> (f64, f64) {
    let back = TRAIL_M + slot as f64 * TRAIL_GAP_M;
    let side = (slot as f64 - (LITTER_COUNT as f64 - 1.0) / 2.0) * LATERAL_M;
    let fx = -yaw.sin();
    let fz = -yaw.cos();
    let rx = yaw.cos();
    let rz = -yaw.sin();
    (mother_x - fx * back + rx * side, mother_z - fz * back + rz * side)
}

/// One follow step. The pup walks toward its trail slot and does not overshoot it.
pub fn follow_step(x: f64, z: f64, slot: u32, mother_x: f64, mother_z: f64, yaw: f64, dt: f64) -> (f64, f64) {
    let (tx, tz) = trail_slot(slot, mother_x, mother_z, yaw);
    let dx = tx - x;
    let dz = tz - z;
    let d = (dx * dx + dz * dz).sqrt();
    if d < 1e-6 || dt <= 0.0 {
        return (x, z);
    }
    let step = (PUP_SPEED_M_S * dt).min(d);
    (x + dx / d * step, z + dz / d * step)
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
        let (x, z) = follow_step(0.0, 0.0, 0, 0.0, 0.0, 0.0, 1.0);
        let (tx, tz) = trail_slot(0, 0.0, 0.0, 0.0);
        let before = (tx * tx + tz * tz).sqrt();
        let after = ((tx - x).powi(2) + (tz - z).powi(2)).sqrt();
        assert!(after < before - 0.5, "moved toward the slot");
        let (sx, sz) = follow_step(tx, tz, 0, 0.0, 0.0, 0.0, 1.0);
        assert!((sx - tx).abs() < 1e-9 && (sz - tz).abs() < 1e-9);
    }
}
