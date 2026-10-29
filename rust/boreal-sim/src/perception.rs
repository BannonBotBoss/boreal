//! Perception block (T-0083, roadmap step 16). Issues #105 and #106.
//!
//! #106 wins the bytes. The block is one contiguous little-endian slice:
//! header, body feelings, emotions, urges, visible things, scent volumes,
//! sounds, memory marks, then whatever bytes a later sense appends.
//! Counts may be zero. Nothing here is drawn, and nothing is JSON.
//!
//! Do not derive this with `#[repr(C)]`. That padding moves the embodied id
//! from byte 20 to byte 24, which breaks the offset table in #106 (roadmap
//! conflict 19). Each stated size is the stride. Where the listed fields
//! are shorter than that size, the difference is a reserved tail:
//! sound is 28 bytes (fields sum to 24), scent is 32 bytes (fields sum to 28).
//! Memory is 20 bytes, which already matches its fields, so it has no extra tail.
//! The header's last 20 bytes stay reserved for later senses (echo, heat,
//! ultraviolet) so those can arrive without moving byte 20.

pub const HEADER_BYTES: usize = 64;
pub const EMBODIED_ID_OFFSET: usize = 20;
pub const HEADER_RESERVED_OFFSET: usize = 44;
pub const HEADER_RESERVED_BYTES: usize = 20;
pub const PHYSIOLOGY_BYTES: usize = 32;
pub const EMOTION_BYTES: usize = 32;
pub const INSTINCT_BYTES: usize = 32;
pub const FIXED_BYTES: usize = HEADER_BYTES + PHYSIOLOGY_BYTES + EMOTION_BYTES + INSTINCT_BYTES;
pub const VISUAL_BYTES: usize = 48;
pub const SCENT_BYTES: usize = 32;
pub const SOUND_BYTES: usize = 28;
pub const MEMORY_BYTES: usize = 20;

/// Issue #106's small caps. The simulation can be huge. One animal's frame is not.
pub const CAP_VISUAL: usize = 32;
pub const CAP_SCENT: usize = 16;
pub const CAP_SOUND: usize = 8;
pub const CAP_MEMORY: usize = 12;

#[derive(Clone, Debug, PartialEq)]
pub struct PerceptionFrame {
    pub frame_id: u64,
    pub timestamp: f64,
    pub species_id: u32,
    pub embodied_id: u64,
    /// Header bytes 44..64. Present on every frame, including a frame with
    /// every count at zero. A later sense claims room here instead of a new version.
    pub reserved: [u8; HEADER_RESERVED_BYTES],
    pub body: Physiology,
    pub emotions: Emotion,
    pub urges: Instinct,
    pub visible: Vec<Visible>,
    pub scents: Vec<Scent>,
    pub sounds: Vec<Sound>,
    pub memories: Vec<Memory>,
    /// Bytes after the memory marks. Empty until a later sense appends them.
    pub tail: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Physiology {
    pub hunger: f32,
    pub thirst: f32,
    pub fatigue: f32,
    pub pain: f32,
    pub temperature_stress: f32,
    pub oxygen_stress: f32,
    pub stamina: f32,
    pub reserved: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Emotion {
    pub fear: f32,
    pub stress: f32,
    pub confidence: f32,
    pub curiosity: f32,
    pub aggression: f32,
    pub social_attachment: f32,
    pub reserved1: f32,
    pub reserved2: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Instinct {
    pub feed_drive: f32,
    pub drink_drive: f32,
    pub safety_drive: f32,
    pub exploration_drive: f32,
    pub mating_drive: f32,
    pub migration_drive: f32,
    pub territorial_drive: f32,
    pub social_drive: f32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Visible {
    pub id: u64,
    pub object_type: u16,
    pub classification: u16,
    pub certainty: f32,
    pub salience: f32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub velocity_x: f32,
    pub velocity_y: f32,
    pub velocity_z: f32,
    pub flags: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Scent {
    pub scent_type: u16,
    pub source_species: u16,
    pub strength: f32,
    pub freshness: f32,
    pub direction_x: f32,
    pub direction_y: f32,
    pub direction_z: f32,
    pub concentration: f32,
    /// Four bytes so the entry stays the 32 #106 states. The listed fields sum to 28.
    pub reserved: [u8; 4],
}

#[derive(Clone, Debug, PartialEq)]
pub struct Sound {
    pub category: u16,
    pub urgency: u16,
    pub intensity: f32,
    pub direction_x: f32,
    pub direction_y: f32,
    pub direction_z: f32,
    pub age_seconds: f32,
    /// Four bytes so the entry stays the 28 #106 states. The listed fields sum to 24.
    pub reserved: [u8; 4],
}

#[derive(Clone, Debug, PartialEq)]
pub struct Memory {
    pub memory_type: u16,
    pub emotion_type: u16,
    pub emotional_weight: f32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PackError {
    TooManyVisible { got: usize },
    TooManyScent { got: usize },
    TooManySound { got: usize },
    TooManyMemory { got: usize },
    Short { need: usize, have: usize },
}

pub fn packed_len(frame: &PerceptionFrame) -> usize {
    FIXED_BYTES
        + frame.visible.len() * VISUAL_BYTES
        + frame.scents.len() * SCENT_BYTES
        + frame.sounds.len() * SOUND_BYTES
        + frame.memories.len() * MEMORY_BYTES
        + frame.tail.len()
}

pub fn write_perception(frame: &PerceptionFrame, out: &mut [u8]) -> Result<usize, PackError> {
    if frame.visible.len() > CAP_VISUAL {
        return Err(PackError::TooManyVisible {
            got: frame.visible.len(),
        });
    }
    if frame.scents.len() > CAP_SCENT {
        return Err(PackError::TooManyScent {
            got: frame.scents.len(),
        });
    }
    if frame.sounds.len() > CAP_SOUND {
        return Err(PackError::TooManySound {
            got: frame.sounds.len(),
        });
    }
    if frame.memories.len() > CAP_MEMORY {
        return Err(PackError::TooManyMemory {
            got: frame.memories.len(),
        });
    }
    let need = packed_len(frame);
    if out.len() < need {
        return Err(PackError::Short {
            need,
            have: out.len(),
        });
    }

    let mut w = W { buf: out, at: 0 };
    w.u64(frame.frame_id);
    w.f64(frame.timestamp);
    w.u32(frame.species_id);
    debug_assert_eq!(w.at, EMBODIED_ID_OFFSET);
    w.u64(frame.embodied_id);
    w.u32(frame.visible.len() as u32);
    w.u32(frame.scents.len() as u32);
    w.u32(frame.sounds.len() as u32);
    w.u32(frame.memories.len() as u32);
    debug_assert_eq!(w.at, HEADER_RESERVED_OFFSET);
    w.bytes(&frame.reserved);
    debug_assert_eq!(w.at, HEADER_BYTES);

    let b = &frame.body;
    for v in [
        b.hunger,
        b.thirst,
        b.fatigue,
        b.pain,
        b.temperature_stress,
        b.oxygen_stress,
        b.stamina,
        b.reserved,
    ] {
        w.f32(v);
    }
    let e = &frame.emotions;
    for v in [
        e.fear,
        e.stress,
        e.confidence,
        e.curiosity,
        e.aggression,
        e.social_attachment,
        e.reserved1,
        e.reserved2,
    ] {
        w.f32(v);
    }
    let u = &frame.urges;
    for v in [
        u.feed_drive,
        u.drink_drive,
        u.safety_drive,
        u.exploration_drive,
        u.mating_drive,
        u.migration_drive,
        u.territorial_drive,
        u.social_drive,
    ] {
        w.f32(v);
    }
    debug_assert_eq!(w.at, FIXED_BYTES);

    for v in &frame.visible {
        w.u64(v.id);
        w.u16(v.object_type);
        w.u16(v.classification);
        for n in [
            v.certainty,
            v.salience,
            v.x,
            v.y,
            v.z,
            v.velocity_x,
            v.velocity_y,
            v.velocity_z,
        ] {
            w.f32(n);
        }
        w.u32(v.flags);
    }
    for s in &frame.scents {
        w.u16(s.scent_type);
        w.u16(s.source_species);
        for n in [
            s.strength,
            s.freshness,
            s.direction_x,
            s.direction_y,
            s.direction_z,
            s.concentration,
        ] {
            w.f32(n);
        }
        w.bytes(&s.reserved);
    }
    for s in &frame.sounds {
        w.u16(s.category);
        w.u16(s.urgency);
        for n in [
            s.intensity,
            s.direction_x,
            s.direction_y,
            s.direction_z,
            s.age_seconds,
        ] {
            w.f32(n);
        }
        w.bytes(&s.reserved);
    }
    for m in &frame.memories {
        w.u16(m.memory_type);
        w.u16(m.emotion_type);
        w.f32(m.emotional_weight);
        w.f32(m.x);
        w.f32(m.y);
        w.f32(m.z);
    }
    w.bytes(&frame.tail);
    debug_assert_eq!(w.at, need);
    Ok(need)
}

pub fn pack(frame: &PerceptionFrame) -> Result<Vec<u8>, PackError> {
    let mut out = vec![0; packed_len(frame)];
    let n = write_perception(frame, &mut out)?;
    out.truncate(n);
    Ok(out)
}

struct W<'a> {
    buf: &'a mut [u8],
    at: usize,
}

impl W<'_> {
    fn bytes(&mut self, b: &[u8]) {
        self.buf[self.at..self.at + b.len()].copy_from_slice(b);
        self.at += b.len();
    }
    fn u16(&mut self, v: u16) {
        self.bytes(&v.to_le_bytes());
    }
    fn u32(&mut self, v: u32) {
        self.bytes(&v.to_le_bytes());
    }
    fn u64(&mut self, v: u64) {
        self.bytes(&v.to_le_bytes());
    }
    fn f32(&mut self, v: f32) {
        self.bytes(&v.to_le_bytes());
    }
    fn f64(&mut self, v: f64) {
        self.bytes(&v.to_le_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn body(start: f32) -> Physiology {
        Physiology {
            hunger: start,
            thirst: start + 1.0,
            fatigue: start + 2.0,
            pain: start + 3.0,
            temperature_stress: start + 4.0,
            oxygen_stress: start + 5.0,
            stamina: start + 6.0,
            reserved: start + 7.0,
        }
    }
    fn emotions(start: f32) -> Emotion {
        Emotion {
            fear: start,
            stress: start + 1.0,
            confidence: start + 2.0,
            curiosity: start + 3.0,
            aggression: start + 4.0,
            social_attachment: start + 5.0,
            reserved1: start + 6.0,
            reserved2: start + 7.0,
        }
    }
    fn urges(start: f32) -> Instinct {
        Instinct {
            feed_drive: start,
            drink_drive: start + 1.0,
            safety_drive: start + 2.0,
            exploration_drive: start + 3.0,
            mating_drive: start + 4.0,
            migration_drive: start + 5.0,
            territorial_drive: start + 6.0,
            social_drive: start + 7.0,
        }
    }

    fn empty() -> PerceptionFrame {
        let mut reserved = [0u8; HEADER_RESERVED_BYTES];
        for (i, b) in reserved.iter_mut().enumerate() {
            *b = 0xE0u8 + i as u8;
        }
        PerceptionFrame {
            frame_id: 1,
            timestamp: 0.0,
            species_id: 0,
            embodied_id: 0,
            reserved,
            body: body(1.0),
            emotions: emotions(9.0),
            urges: urges(17.0),
            visible: vec![],
            scents: vec![],
            sounds: vec![],
            memories: vec![],
            tail: (0..16).map(|i| 0xF0u8 + i as u8).collect(),
        }
    }

    fn known() -> PerceptionFrame {
        let mut reserved = [0u8; HEADER_RESERVED_BYTES];
        for (i, b) in reserved.iter_mut().enumerate() {
            *b = 0xA0u8 + i as u8;
        }
        PerceptionFrame {
            frame_id: 0x0102_0304_0506_0708,
            timestamp: 1_728_000.5,
            species_id: 7,
            embodied_id: 0x8877_6655_4433_2211,
            reserved,
            body: body(1.0),
            emotions: emotions(9.0),
            urges: urges(17.0),
            visible: vec![
                Visible {
                    id: 1001,
                    object_type: 3,
                    classification: 4,
                    certainty: 38.0,
                    salience: 91.0,
                    x: 120.0,
                    y: 1.0,
                    z: -4.0,
                    velocity_x: 0.5,
                    velocity_y: -0.25,
                    velocity_z: 0.125,
                    flags: 0x00A1_B2C3,
                },
                Visible {
                    id: 1002,
                    object_type: 8,
                    classification: 9,
                    certainty: 1.0,
                    salience: 2.0,
                    x: 3.0,
                    y: 4.0,
                    z: 5.0,
                    velocity_x: 6.0,
                    velocity_y: 7.0,
                    velocity_z: 8.0,
                    flags: 0x0102_0304,
                },
            ],
            scents: vec![Scent {
                scent_type: 5,
                source_species: 6,
                strength: 0.5,
                freshness: 0.25,
                direction_x: 0.0,
                direction_y: 1.0,
                direction_z: 0.0,
                concentration: 0.125,
                reserved: [0x51, 0x52, 0x53, 0x54],
            }],
            sounds: vec![
                Sound {
                    category: 9,
                    urgency: 2,
                    intensity: 0.5,
                    direction_x: 1.0,
                    direction_y: 0.0,
                    direction_z: 0.0,
                    age_seconds: 1.5,
                    reserved: [0xAA, 0xBB, 0xCC, 0xDD],
                },
                Sound {
                    category: 11,
                    urgency: 4,
                    intensity: 2.0,
                    direction_x: 0.0,
                    direction_y: 0.0,
                    direction_z: 1.0,
                    age_seconds: 3.0,
                    reserved: [0x11, 0x22, 0x33, 0x44],
                },
            ],
            memories: vec![
                Memory {
                    memory_type: 1,
                    emotion_type: 2,
                    emotional_weight: 0.75,
                    x: 10.0,
                    y: 0.0,
                    z: -4.0,
                },
                Memory {
                    memory_type: 7,
                    emotion_type: 8,
                    emotional_weight: 1.0,
                    x: 20.0,
                    y: 30.0,
                    z: 40.0,
                },
            ],
            tail: (0..8).map(|i| 0xB0u8 + i as u8).collect(),
        }
    }

    fn fixture(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/fixtures")
            .join(name)
    }

    #[test]
    fn header_offsets_match_issue_106() {
        let bytes = pack(&known()).unwrap();
        assert_eq!(
            u64::from_le_bytes(bytes[0..8].try_into().unwrap()),
            0x0102_0304_0506_0708
        );
        assert_eq!(
            f64::from_le_bytes(bytes[8..16].try_into().unwrap()),
            1_728_000.5
        );
        assert_eq!(u32::from_le_bytes(bytes[16..20].try_into().unwrap()), 7);
        // Embodied id at byte 20, not padded out to 24.
        assert_eq!(
            u64::from_le_bytes(bytes[20..28].try_into().unwrap()),
            0x8877_6655_4433_2211
        );
        assert_eq!(u32::from_le_bytes(bytes[28..32].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(bytes[32..36].try_into().unwrap()), 1);
        assert_eq!(u32::from_le_bytes(bytes[36..40].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(bytes[40..44].try_into().unwrap()), 2);
        assert_eq!(
            &bytes[44..64],
            &(0..20).map(|i| 0xA0u8 + i as u8).collect::<Vec<_>>()
        );
        assert_eq!(f32::from_le_bytes(bytes[64..68].try_into().unwrap()), 1.0); // hunger
        assert_eq!(f32::from_le_bytes(bytes[96..100].try_into().unwrap()), 9.0); // fear
        assert_eq!(
            f32::from_le_bytes(bytes[128..132].try_into().unwrap()),
            17.0
        ); // feed drive
        let sound_at = 160 + 2 * VISUAL_BYTES + SCENT_BYTES;
        assert_eq!(sound_at, 288);
        assert_eq!(
            u16::from_le_bytes(bytes[sound_at..sound_at + 2].try_into().unwrap()),
            9
        );
        assert_eq!(
            &bytes[sound_at + 24..sound_at + 28],
            &[0xAA, 0xBB, 0xCC, 0xDD]
        );
        assert_eq!(
            u16::from_le_bytes(
                bytes[sound_at + SOUND_BYTES..sound_at + SOUND_BYTES + 2]
                    .try_into()
                    .unwrap()
            ),
            11
        );
        let memory_at = sound_at + 2 * SOUND_BYTES;
        assert_eq!(
            u16::from_le_bytes(bytes[memory_at..memory_at + 2].try_into().unwrap()),
            1
        );
        assert_eq!(
            u16::from_le_bytes(
                bytes[memory_at + MEMORY_BYTES..memory_at + MEMORY_BYTES + 2]
                    .try_into()
                    .unwrap()
            ),
            7
        );
        assert_eq!(
            &bytes[memory_at + 2 * MEMORY_BYTES..],
            &[0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7]
        );
        assert_eq!(bytes.len(), memory_at + 2 * MEMORY_BYTES + 8);
    }

    #[test]
    fn zero_counts_still_carry_the_reserved_tails() {
        let bytes = pack(&empty()).unwrap();
        assert_eq!(u32::from_le_bytes(bytes[28..32].try_into().unwrap()), 0);
        assert_eq!(u32::from_le_bytes(bytes[32..36].try_into().unwrap()), 0);
        assert_eq!(u32::from_le_bytes(bytes[36..40].try_into().unwrap()), 0);
        assert_eq!(u32::from_le_bytes(bytes[40..44].try_into().unwrap()), 0);
        assert_eq!(bytes.len(), FIXED_BYTES + 16);
        assert_eq!(
            &bytes[44..64],
            &(0..20).map(|i| 0xE0u8 + i as u8).collect::<Vec<_>>()
        );
        assert_eq!(
            &bytes[FIXED_BYTES..],
            &(0..16).map(|i| 0xF0u8 + i as u8).collect::<Vec<_>>()
        );
        // The body and emotion reserved floats are inside the fixed block, not dropped when counts are zero.
        assert_eq!(f32::from_le_bytes(bytes[92..96].try_into().unwrap()), 8.0);
        assert_eq!(
            f32::from_le_bytes(bytes[120..124].try_into().unwrap()),
            15.0
        );
        assert_eq!(
            f32::from_le_bytes(bytes[124..128].try_into().unwrap()),
            16.0
        );
    }

    #[test]
    fn caps_reject_a_frame_that_would_stream_the_whole_world() {
        let mut frame = empty();
        frame.tail.clear();
        frame.visible = vec![
            Visible {
                id: 1,
                object_type: 0,
                classification: 0,
                certainty: 0.0,
                salience: 0.0,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                velocity_x: 0.0,
                velocity_y: 0.0,
                velocity_z: 0.0,
                flags: 0
            };
            33
        ];
        assert_eq!(
            write_perception(&frame, &mut vec![0; 4096]),
            Err(PackError::TooManyVisible { got: 33 })
        );
        frame.visible.clear();
        frame.sounds = vec![
            Sound {
                category: 0,
                urgency: 0,
                intensity: 0.0,
                direction_x: 0.0,
                direction_y: 0.0,
                direction_z: 0.0,
                age_seconds: 0.0,
                reserved: [0; 4]
            };
            9
        ];
        assert_eq!(
            write_perception(&frame, &mut vec![0; 4096]),
            Err(PackError::TooManySound { got: 9 })
        );
    }

    #[test]
    fn writer_matches_the_committed_fixtures() {
        for (name, frame) in [
            ("perception-empty.bin", empty()),
            ("perception-known.bin", known()),
        ] {
            let got = pack(&frame).unwrap();
            let path = fixture(name);
            if std::env::var_os("PERCEPTION_DUMP").is_some() {
                std::fs::create_dir_all(path.parent().unwrap()).unwrap();
                std::fs::write(&path, &got).unwrap();
            }
            let expected =
                std::fs::read(&path).unwrap_or_else(|_| panic!("missing {}", path.display()));
            assert_eq!(got, expected, "{name}");
        }
    }
}
