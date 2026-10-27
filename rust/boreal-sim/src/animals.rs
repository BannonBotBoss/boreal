//! Animals recorded in the step 11 store (T-0092, roadmap step 12).
//! Issues #101 and #102.
//!
//! The species row stays in TypeScript (`NEEDS_SPECIES`, `MAMMALS`, `LIFESPAN`).
//! This module stores a key, not a copy of the spec and not a skeleton.
//! Needs are the three levels `stepNeeds` already steps. Drives (#117) and the
//! event log (#119) are not here. Nothing in this module acts.
//! Conflict 10: the physiology weight is not a component. Step 18 (T-0102)
//! stores feelings beside Needs and Age. The generated volume stays outside
//! this crate. The feelings record has no weight field.

use hecs::{Entity, World};

/// `wolf` in `NEEDS_SPECIES`. Same code as `STORED_SPECIES.wolf`.
pub const SPECIES_WOLF: u8 = 1;
/// `hare` in `NEEDS_SPECIES`. Same code as `STORED_SPECIES.hare`.
pub const SPECIES_HARE: u8 = 2;
/// `canid` on the Gray Wolf `MAMMALS` row.
pub const ARCHETYPE_CANID: u8 = 1;
/// `leporid` on the Snowshoe Hare `MAMMALS` row.
pub const ARCHETYPE_LEPORID: u8 = 2;

/// Little-endian `ANM1` record. Header is 12 bytes, then one 76-byte animal.
pub const ANIMAL_BYTES: usize = 76;
pub const PACK_HEADER_BYTES: usize = 12;

/// Names of the components `spawn_animal` inserts. The list is the contract.
pub const COMPONENT_NAMES: &[&str] = &[
    "SpeciesRow",
    "Position",
    "Age",
    "Needs",
    "Kinship",
    "Territory",
    "BodyFeelings",
];

/// Little-endian `BDY1` feelings. Header is 12 bytes, then one 32-byte row
/// (handle plus the six feeling floats). There is no seventh float.
pub const FEELINGS_BYTES: usize = 32;
pub const FEELINGS_HEADER_BYTES: usize = 12;

/// Key into the existing species rows. Not the row itself.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpeciesRow {
    pub species: u8,
    pub archetype: u8,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Position {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Age {
    pub years: f64,
}

/// Water, energy, and rest, as percentages. The rates stay on the species row.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Needs {
    pub water: f32,
    pub energy: f32,
    pub rest: f32,
}

/// Parent handle, or 0 when that parent is not in the store.
/// `founder` is stored on its own. It is not inferred from a zero parent.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Kinship {
    pub parent: u64,
    pub founder: bool,
}

/// The animal that holds this ground, and that animal's home point.
/// Pack mates share the founder's handle. There is no radius in this step.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Territory {
    pub holder: u64,
    pub x: f64,
    pub z: f64,
}

/// What the body feels, apart from the reserves on `Needs` and the years on `Age`.
/// Six f32. Opening values are `Default`. Pain and oxygen stress stay 0 because
/// this step has no injury rate and no oxygen-debt rate (calibration). Health
/// and stamina start full on the needs percent scale. Temperature 0 means no
/// air sample yet, so the heat feeling stays 0. The TypeScript step (`stepNeeds`,
/// `heatFactor`, `staminaRates`) is what moves them. This struct does not.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BodyFeelings {
    pub stamina: f32,
    pub pain: f32,
    pub health: f32,
    pub temperature_c: f32,
    pub temperature_stress: f32,
    pub oxygen_stress: f32,
}

impl Default for BodyFeelings {
    fn default() -> Self {
        Self {
            stamina: 100.0,
            pain: 0.0,
            health: 100.0,
            temperature_c: 0.0,
            temperature_stress: 0.0,
            oxygen_stress: 0.0,
        }
    }
}

/// One animal's feelings, for the `BDY1` bytes.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FeelingsRow {
    pub handle: u64,
    pub feelings: BodyFeelings,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpawnAnimal {
    pub species: u8,
    pub archetype: u8,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub age_years: f64,
    pub water: f32,
    pub energy: f32,
    pub rest: f32,
    pub parent: u64,
    pub founder: bool,
    /// 0 means "this animal's own handle", filled in after spawn.
    pub territory_holder: u64,
    pub territory_x: f64,
    pub territory_z: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PackSpawn {
    pub species: u8,
    pub archetype: u8,
    pub count: u32,
    pub age_years: f64,
    pub spacing_m: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub water: f32,
    pub energy: f32,
    pub rest: f32,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AnimalView {
    pub handle: u64,
    pub species: u8,
    pub archetype: u8,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub age_years: f64,
    pub water: f32,
    pub energy: f32,
    pub rest: f32,
    pub parent: u64,
    pub founder: bool,
    pub territory: u64,
    pub territory_x: f64,
    pub territory_z: f64,
}

pub fn spawn_animal(world: &mut World, spec: SpawnAnimal) -> AnimalView {
    let entity = world.spawn((
        SpeciesRow { species: spec.species, archetype: spec.archetype },
        Position { x: spec.x, y: spec.y, z: spec.z },
        Age { years: spec.age_years },
        Needs { water: spec.water, energy: spec.energy, rest: spec.rest },
        Kinship { parent: spec.parent, founder: spec.founder },
        Territory { holder: spec.territory_holder, x: spec.territory_x, z: spec.territory_z },
        BodyFeelings::default(),
    ));
    let handle = entity.to_bits().get();
    if spec.territory_holder == 0 {
        world.get::<&mut Territory>(entity).expect("territory").holder = handle;
    }
    read_animal(world, handle).expect("spawned animal")
}

/// One pack. Every member is a founder. Mates are `spacing_m` apart on x.
/// They share the first animal's handle as the territory holder.
pub fn spawn_pack(world: &mut World, pack: PackSpawn) -> Vec<AnimalView> {
    let mut out = Vec::with_capacity(pack.count as usize);
    let mut holder = 0u64;
    for i in 0..pack.count {
        let view = spawn_animal(world, SpawnAnimal {
            species: pack.species,
            archetype: pack.archetype,
            x: pack.x + pack.spacing_m * f64::from(i),
            y: pack.y,
            z: pack.z,
            age_years: pack.age_years,
            water: pack.water,
            energy: pack.energy,
            rest: pack.rest,
            parent: 0,
            founder: true,
            territory_holder: holder,
            territory_x: pack.x,
            territory_z: pack.z,
        });
        if holder == 0 {
            holder = view.handle;
        }
        out.push(view);
    }
    out
}

pub fn read_animal(world: &World, handle: u64) -> Option<AnimalView> {
    let entity = Entity::from_bits(handle)?;
    if !world.contains(entity) {
        return None;
    }
    let (species, archetype) = {
        let row = world.get::<&SpeciesRow>(entity).ok()?;
        (row.species, row.archetype)
    };
    let (x, y, z) = {
        let p = world.get::<&Position>(entity).ok()?;
        (p.x, p.y, p.z)
    };
    let age_years = world.get::<&Age>(entity).ok()?.years;
    let (water, energy, rest) = {
        let n = world.get::<&Needs>(entity).ok()?;
        (n.water, n.energy, n.rest)
    };
    let (parent, founder) = {
        let k = world.get::<&Kinship>(entity).ok()?;
        (k.parent, k.founder)
    };
    let (territory, territory_x, territory_z) = {
        let t = world.get::<&Territory>(entity).ok()?;
        (t.holder, t.x, t.z)
    };
    Some(AnimalView {
        handle,
        species,
        archetype,
        x,
        y,
        z,
        age_years,
        water,
        energy,
        rest,
        parent,
        founder,
        territory,
        territory_x,
        territory_z,
    })
}

pub fn read_feelings(world: &World, handle: u64) -> Option<BodyFeelings> {
    let entity = Entity::from_bits(handle)?;
    let feelings = world.get::<&BodyFeelings>(entity).ok()?;
    Some(*feelings)
}

pub fn set_feelings(world: &mut World, handle: u64, feelings: BodyFeelings) -> bool {
    let Some(entity) = Entity::from_bits(handle) else {
        return false;
    };
    let Ok(mut slot) = world.get::<&mut BodyFeelings>(entity) else {
        return false;
    };
    *slot = feelings;
    true
}

pub fn feelings_of(world: &World, animals: &[AnimalView]) -> Vec<FeelingsRow> {
    animals
        .iter()
        .filter_map(|animal| {
            read_feelings(world, animal.handle).map(|feelings| FeelingsRow {
                handle: animal.handle,
                feelings,
            })
        })
        .collect()
}

/// Header `BDY1`, version 1, count, then `FEELINGS_BYTES` per animal.
/// Each row is the handle and the six feeling floats. No weight float.
pub fn write_feelings(rows: &[FeelingsRow]) -> Vec<u8> {
    let mut out = Vec::with_capacity(FEELINGS_HEADER_BYTES + rows.len() * FEELINGS_BYTES);
    out.extend_from_slice(b"BDY1");
    out.extend_from_slice(&1u32.to_le_bytes());
    out.extend_from_slice(&(rows.len() as u32).to_le_bytes());
    for row in rows {
        let f = row.feelings;
        out.extend_from_slice(&row.handle.to_le_bytes());
        out.extend_from_slice(&f.stamina.to_le_bytes());
        out.extend_from_slice(&f.pain.to_le_bytes());
        out.extend_from_slice(&f.health.to_le_bytes());
        out.extend_from_slice(&f.temperature_c.to_le_bytes());
        out.extend_from_slice(&f.temperature_stress.to_le_bytes());
        out.extend_from_slice(&f.oxygen_stress.to_le_bytes());
    }
    out
}

/// Header `ANM1`, version 1, count, then `ANIMAL_BYTES` per animal.
/// The last 4 bytes of each animal are zero. They are not a weight.
pub fn write_animals(animals: &[AnimalView]) -> Vec<u8> {
    let mut out = Vec::with_capacity(PACK_HEADER_BYTES + animals.len() * ANIMAL_BYTES);
    out.extend_from_slice(b"ANM1");
    out.extend_from_slice(&1u32.to_le_bytes());
    out.extend_from_slice(&(animals.len() as u32).to_le_bytes());
    for a in animals {
        out.extend_from_slice(&a.handle.to_le_bytes());
        out.push(a.species);
        out.push(a.archetype);
        out.push(u8::from(a.founder));
        out.push(0);
        out.extend_from_slice(&a.parent.to_le_bytes());
        out.extend_from_slice(&a.territory.to_le_bytes());
        out.extend_from_slice(&a.age_years.to_le_bytes());
        out.extend_from_slice(&a.x.to_le_bytes());
        out.extend_from_slice(&a.y.to_le_bytes());
        out.extend_from_slice(&a.z.to_le_bytes());
        out.extend_from_slice(&a.water.to_le_bytes());
        out.extend_from_slice(&a.energy.to_le_bytes());
        out.extend_from_slice(&a.rest.to_le_bytes());
        out.extend_from_slice(&0f32.to_le_bytes());
    }
    out
}
