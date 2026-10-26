//! Empty entity world (T-0084, roadmap step 11). Issues #101, #117, #118, #119.
//!
//! One component store, `hecs` 0.10.5. An empty world constructs. Nothing acts.
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

    /// An entity with no components. Age, needs, and drives are later steps.
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
}
