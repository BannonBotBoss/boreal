//! Empty entity world (T-0084, roadmap step 11). Issues #101, #117, #118, #119.
//!
//! One component store, `hecs` 0.10.5. An empty world constructs. Nothing acts.
//! Step 12 records animals on this same store (`animals`). It does not step them.
//! A handle is `Entity::to_bits`: one `NonZeroU64`, stored here as a `u64`.
//! `World::contains` is false after `despawn`, including when the slot is reused,
//! because the generation in the high half moves. Issue #117's drives are
//! components on this store later. They are not added here. Issue #119's event
//! log is not built here. There is no second list of entities on the TypeScript side.

use hecs::{Entity, World};

/// One integer a later inspector (#118) or event record (#119) can store.
/// Zero is not a handle. `Entity::to_bits` is a `NonZeroU64`.
pub type Handle = u64;

/// The simulation's only entity store. Step 11 leaves it empty of behaviour.
/// Step 12 records animals here. The picture still does not read them.
pub struct EntityStore {
    world: World,
}

impl EntityStore {
    pub fn empty() -> Self {
        Self { world: World::new() }
    }

    pub fn len(&self) -> u32 {
        self.world.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// An entity with no components. Drives are still a later step.
    pub fn spawn(&mut self) -> Handle {
        self.world.spawn(()).to_bits().get()
    }

    /// `true` when this handle named a live entity and that entity is now gone.
    pub fn remove(&mut self, handle: Handle) -> bool {
        match Entity::from_bits(handle) {
            Some(entity) => self.world.despawn(entity).is_ok(),
            None => false,
        }
    }

    /// `false` after removal, and `false` for a bit pattern that is not a handle.
    pub fn alive(&self, handle: Handle) -> bool {
        match Entity::from_bits(handle) {
            Some(entity) => self.world.contains(entity),
            None => false,
        }
    }

    pub fn iter_count(&self) -> usize {
        self.world.iter().count()
    }

    /// One animal, with the step 12 components. A bare `spawn` handle reads back as `None`.
    pub fn spawn_animal(&mut self, spec: crate::animals::SpawnAnimal) -> crate::animals::AnimalView {
        crate::animals::spawn_animal(&mut self.world, spec)
    }

    /// A pack of founders. Count, age, and spacing are the caller's species-row values.
    pub fn spawn_pack(&mut self, pack: crate::animals::PackSpawn) -> Vec<crate::animals::AnimalView> {
        crate::animals::spawn_pack(&mut self.world, pack)
    }

    /// `None` when the handle is empty, bare, or already removed.
    pub fn animal(&self, handle: Handle) -> Option<crate::animals::AnimalView> {
        crate::animals::read_animal(&self.world, handle)
    }

    /// Feelings on a stored animal. `None` for a bare spawn or a removed handle.
    pub fn feelings(&self, handle: Handle) -> Option<crate::animals::BodyFeelings> {
        crate::animals::read_feelings(&self.world, handle)
    }

    /// Replace the feelings on an animal that already has them. A bare spawn stays bare.
    pub fn set_feelings(&mut self, handle: Handle, feelings: crate::animals::BodyFeelings) -> bool {
        crate::animals::set_feelings(&mut self.world, handle, feelings)
    }
}

#[cfg(test)]
mod tests {
    use super::EntityStore;
    use std::mem::size_of;

    #[test]
    fn empty_world_constructs() {
        let world = hecs::World::new();
        assert_eq!(world.len(), 0);
        assert_eq!(world.iter().count(), 0);
        let store = EntityStore::empty();
        assert!(store.is_empty());
        assert_eq!(store.len(), 0);
        assert_eq!(store.iter_count(), 0);
    }

    #[test]
    fn handle_is_one_integer_and_fails_after_removal() {
        assert_eq!(size_of::<super::Handle>(), size_of::<u64>());
        let mut store = EntityStore::empty();
        assert!(!store.alive(0));
        let first = store.spawn();
        assert_ne!(first, 0);
        assert!(store.alive(first));
        assert!(store.remove(first));
        assert!(!store.alive(first));
        assert!(!store.remove(first));
        let second = store.spawn();
        assert!(store.alive(second));
        assert!(!store.alive(first));
        assert_ne!(first, second);
        // The slot may be reused. The old integer still fails.
        assert_eq!(first as u32, second as u32);
        assert_ne!(first >> 32, second >> 32);
    }

    /// Count benchmark: create, remove half, iterate the rest. The counts are the result.
    #[test]
    fn create_remove_iterate_counts() {
        const N: u32 = 8192;
        let mut store = EntityStore::empty();
        let started = std::time::Instant::now();
        let mut handles = Vec::with_capacity(N as usize);
        for _ in 0..N {
            handles.push(store.spawn());
        }
        let created = store.len();
        let create_us = started.elapsed().as_micros();

        let started = std::time::Instant::now();
        let mut removed = 0u32;
        for handle in handles.iter().step_by(2) {
            assert!(store.remove(*handle));
            removed += 1;
        }
        let remove_us = started.elapsed().as_micros();

        let started = std::time::Instant::now();
        let iterated = store.iter_count();
        let iterate_us = started.elapsed().as_micros();

        eprintln!(
            "create={created} remove={removed} iterate={iterated} create_us={create_us} remove_us={remove_us} iterate_us={iterate_us}"
        );
        assert_eq!(created, N);
        assert_eq!(removed, N / 2);
        assert_eq!(iterated, (N / 2) as usize);
        assert_eq!(store.len() as usize, iterated);
        for (i, handle) in handles.iter().enumerate() {
            assert_eq!(store.alive(*handle), i % 2 == 1);
        }
    }

    fn wolf_pack() -> crate::animals::PackSpawn {
        // Row values at the time of the fixture. tests/stored-animal.test.ts checks
        // them against LIFESPAN and WOLF_NEEDS. They are not a second citation.
        crate::animals::PackSpawn {
            species: crate::animals::SPECIES_WOLF,
            archetype: crate::animals::ARCHETYPE_CANID,
            count: 2,
            age_years: 2.0,
            spacing_m: 5.0,
            // Recorded stand: dryStart(0, 0) on seed 1400 is (30, 0). The
            // test origin (0, 0) is open water on the staged land. Not a
            // new length. The mate is one wolf spacing (5 m) along x.
            x: 30.0,
            y: 0.0,
            z: 0.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
        }
    }

    fn hare() -> crate::animals::PackSpawn {
        crate::animals::PackSpawn {
            species: crate::animals::SPECIES_HARE,
            archetype: crate::animals::ARCHETYPE_LEPORID,
            count: 1,
            age_years: 1.0,
            spacing_m: 20.0,
            // One hare spacing east of the wolf stand, so it is not inside the wolf.
            x: 50.0,
            y: 0.0,
            z: 0.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
        }
    }

    fn deer() -> crate::animals::PackSpawn {
        crate::animals::PackSpawn {
            species: crate::animals::SPECIES_DEER,
            archetype: crate::animals::ARCHETYPE_CERVID,
            count: 1,
            age_years: 2.0,
            spacing_m: 0.0,
            // One hare spacing north of the wolf stand. That metre is the
            // hare row, used so the deer is not standing on the wolf.
            // isDry(30, 20) on seed 1400. Not a deer group size.
            x: 30.0,
            y: 0.0,
            z: 20.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
        }
    }

    #[test]
    fn component_names_have_no_weight_field() {
        let names = crate::animals::COMPONENT_NAMES;
        assert_eq!(names.len(), 7);
        assert_eq!(names[6], "BodyFeelings");
        for name in names {
            assert!(!name.to_ascii_lowercase().contains("mass"), "{name}");
        }
        let src = include_str!("animals.rs");
        assert!(!src.contains("body_mass"));
        assert!(!src.contains("BodyMass"));
        assert_eq!(std::mem::size_of::<crate::animals::BodyFeelings>(), 24);
    }

    #[test]
    fn bare_spawn_is_not_an_animal() {
        let mut store = EntityStore::empty();
        let handle = store.spawn();
        assert!(store.alive(handle));
        assert!(store.animal(handle).is_none());
    }

    #[test]
    fn wolf_spawned_by_the_store_has_age_and_founder_flag() {
        let mut store = EntityStore::empty();
        let wolves = store.spawn_pack(wolf_pack());
        assert_eq!(wolves.len(), 2);
        let wolf = &wolves[0];
        assert!(wolf.age_years > 0.0);
        assert_eq!(wolf.age_years, 2.0);
        assert!(wolf.founder);
        assert_eq!(wolf.parent, 0);
        assert_eq!(wolf.species, crate::animals::SPECIES_WOLF);
        assert_eq!(wolf.archetype, crate::animals::ARCHETYPE_CANID);
        assert_eq!(wolf.territory, wolf.handle);
        assert_eq!(wolves[1].x, 35.0);
        assert!(wolves[1].founder);
        assert_eq!(wolves[1].parent, 0);
        assert_eq!(wolves[1].territory, wolf.handle);
        assert_eq!(wolves[1].age_years, wolf.age_years);
        let again = store.animal(wolf.handle).expect("wolf");
        assert_eq!(again, *wolf);
        assert!(store.remove(wolf.handle));
        assert!(store.animal(wolf.handle).is_none());
        assert!(!store.alive(wolf.handle));
        assert!(store.animal(wolves[1].handle).is_some());
    }

    #[test]
    fn parent_id_is_stored_separately_from_the_founder_flag() {
        let mut store = EntityStore::empty();
        let founder = store.spawn_animal(crate::animals::SpawnAnimal {
            species: crate::animals::SPECIES_WOLF,
            archetype: crate::animals::ARCHETYPE_CANID,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            age_years: 2.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
            parent: 0,
            founder: true,
            territory_holder: 0,
            territory_x: 0.0,
            territory_z: 0.0,
        });
        let kin = store.spawn_animal(crate::animals::SpawnAnimal {
            species: crate::animals::SPECIES_WOLF,
            archetype: crate::animals::ARCHETYPE_CANID,
            x: 5.0,
            y: 0.0,
            z: 0.0,
            age_years: 2.0,
            water: 100.0,
            energy: 75.0,
            rest: 100.0,
            parent: founder.handle,
            founder: false,
            territory_holder: founder.handle,
            territory_x: 0.0,
            territory_z: 0.0,
        });
        assert!(kin.age_years > 0.0);
        assert!(!kin.founder);
        assert_eq!(kin.parent, founder.handle);
        assert_ne!(kin.parent, 0);
        assert_eq!(kin.territory, founder.handle);
    }

    #[test]
    fn store_fixture_matches_the_committed_bytes() {
        let mut store = EntityStore::empty();
        let mut animals = store.spawn_pack(wolf_pack());
        animals.extend(store.spawn_pack(hare()));
        animals.extend(store.spawn_pack(deer()));
        assert_eq!(animals.len(), 4);
        assert_eq!(animals[2].species, crate::animals::SPECIES_HARE);
        assert_eq!(animals[2].age_years, 1.0);
        assert!(animals[2].founder);
        assert_eq!(animals[2].territory, animals[2].handle);
        assert_eq!(animals[2].x, 50.0);
        assert_eq!(animals[3].species, crate::animals::SPECIES_DEER);
        assert_eq!(animals[3].archetype, crate::animals::ARCHETYPE_CERVID);
        assert_eq!(animals[3].age_years, 2.0);
        assert!(animals[3].founder);
        assert_eq!(animals[3].x, 30.0);
        assert_eq!(animals[3].z, 20.0);
        assert_eq!(animals[0].x, 30.0);
        let got = crate::animals::write_animals(&animals);
        assert_eq!(got.len(), crate::animals::PACK_HEADER_BYTES + crate::animals::ANIMAL_BYTES * 4);
        assert_eq!(&got[0..4], b"ANM1");
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tests/fixtures/stored-wolf-pack.bin");
        if std::env::var_os("STORE_DUMP").is_some() {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, &got).unwrap();
        }
        let expected = std::fs::read(&path).unwrap_or_else(|_| panic!("missing {}", path.display()));
        assert_eq!(got, expected);
    }

    #[test]
    fn spawned_animal_has_feelings_and_no_weight_float() {
        let mut store = EntityStore::empty();
        let bare = store.spawn();
        assert!(store.feelings(bare).is_none());
        assert!(!store.set_feelings(bare, crate::animals::BodyFeelings::default()));
        let wolves = store.spawn_pack(wolf_pack());
        let wolf = wolves[0].handle;
        let opening = store.feelings(wolf).expect("feelings");
        assert_eq!(opening, crate::animals::BodyFeelings::default());
        assert_eq!(opening.stamina, 100.0);
        assert_eq!(opening.pain, 0.0);
        assert_eq!(opening.health, 100.0);
        assert_eq!(opening.temperature_c, 0.0);
        assert_eq!(opening.temperature_stress, 0.0);
        assert_eq!(opening.oxygen_stress, 0.0);
        let written = crate::animals::BodyFeelings {
            pain: 1.25,
            ..crate::animals::BodyFeelings::default()
        };
        assert!(store.set_feelings(wolf, written));
        assert_eq!(store.feelings(wolf).unwrap().pain, 1.25);
        assert_eq!(store.feelings(wolf).unwrap().stamina, 100.0);
        assert!(store.remove(wolf));
        assert!(store.feelings(wolf).is_none());
    }

    #[test]
    fn feelings_fixture_matches_the_committed_bytes() {
        let mut store = EntityStore::empty();
        let mut animals = store.spawn_pack(wolf_pack());
        animals.extend(store.spawn_pack(hare()));
        animals.extend(store.spawn_pack(deer()));
        let animal_bytes = crate::animals::write_animals(&animals);
        let animal_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures/stored-wolf-pack.bin");
        let animal_expected = std::fs::read(&animal_path).expect("animal fixture");
        assert_eq!(animal_bytes, animal_expected, "feelings fixture must share the animal handles");
        let rows = crate::animals::feelings_of(&store.world, &animals);
        assert_eq!(rows.len(), 4);
        let got = crate::animals::write_feelings(&rows);
        assert_eq!(
            got.len(),
            crate::animals::FEELINGS_HEADER_BYTES + crate::animals::FEELINGS_BYTES * 4
        );
        assert_eq!(&got[0..4], b"BDY1");
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures/body-feelings.bin");
        if std::env::var_os("FEELINGS_DUMP").is_some() {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(&path, &got).unwrap();
        }
        let expected = std::fs::read(&path).unwrap_or_else(|_| panic!("missing {}", path.display()));
        assert_eq!(got, expected);
    }
}
