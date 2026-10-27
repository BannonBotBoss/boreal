# Skill: pack one perception block the animal can sense

Use when the viewer needs what an embodied animal perceives, or when a later sense (echo, heat, ultraviolet) has to join that block. T-0083 did the first version from issues #105 and #106. #106 wins the bytes. Roadmap step 16. Nothing in this block is drawn.

## Steps
1. Read issue #106's offset table before writing a struct. The embodied id is at byte 20. `#[repr(C)]` pads it to byte 24 because a `u64` wants an 8-byte slot after the species `u32`. Write the bytes yourself, little-endian, in the issue's order: header, body feelings, emotions, urges, visible things, scent volumes, sounds, memory marks.
2. Use the issue's stated size as the stride. Sound fields sum to 24 and the issue says 28, so the last 4 bytes are reserved. Scent fields sum to 28 and the issue says 32, so the last 4 bytes are reserved. Memory fields already sum to 20, so a memory entry stays 20 bytes with no extra tail. Header bytes 44 through 63 are the 20 reserved bytes. They are present even when every count is zero.
3. Keep the caps at the issue's example: 32 visible, 16 scents, 8 sounds, 12 memories. A frame over a cap is an error. A count of zero is a legal frame. The fixed blocks (header, body, emotions, urges) are still there.
4. A later sense appends after the memory marks and may claim bytes inside the header's reserved tail. Do not insert a field in front of the embodied id, and do not bump a version to add echo, heat, or ultraviolet. The TypeScript reader treats bytes past the memory marks as that tail, so an older reader still sees the current fields.
5. The Rust writer is `write_perception` in `rust/boreal-sim/src/perception.rs`. The TypeScript reader is `readPerception` in `src/core/perceptionBuffer.ts`. They meet on `tests/fixtures/perception-empty.bin` and `tests/fixtures/perception-known.bin`. Regenerate those only from the Rust writer (`PERCEPTION_DUMP=1 cargo test --manifest-path rust/boreal-sim/Cargo.toml writer_matches`), then re-read them from TypeScript. Do not hand-edit the bytes.
6. Do not send the world as JSON. Positions in this block are little-endian floats. Issue #105's nested structs and issue #101's JSON list are not this contract.

## Checks that prove it worked
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml` includes the perception tests. Byte 20 of the known fixture is the embodied id `0x8877665544332211`, and byte 16 is the species, so nothing sits between them.
- `tests/perception-buffer.test.ts` reads both fixtures. A sound's next entry starts 28 bytes later, and the 4 bytes before that are the reserved tail. A memory's next entry starts 20 bytes later. Hunger is the float at byte 64. Fear is the float at byte 96.
- The empty fixture has every count at zero, a 20-byte header tail, and bytes after the fixed block. The reader returns empty lists and those tails.
- A count of 33 visible things throws. The perception sources do not call `JSON.stringify` or `serde_json`.
- `npx tsc --noEmit` and `npm test` pass. Frame gate is N/A: nothing is drawn. Numbers gate is N/A: the sizes are the issue's layout, not physical constants.

## Mistakes to avoid
- Deriving the header with `#[repr(C)]`. The embodied id moves to byte 24 and the offset table is wrong.
- Adding 16 reserved bytes to every struct because the issue also says "reserve bytes". That breaks the stated sizes. The stated size wins. Memory stays 20. Sound's extra is 4, not 16.
- Treating a zero count as "omit the header". The header, the body, the emotions, and the urges are always in the block.
- Building a second writer in TypeScript. The TypeScript side reads. If both sides wrote, a shared mistake would look like agreement.
- Serializing animal positions as JSON for the viewer. That is the contract issue #106 replaced. The boundary guard is `tests/no-raw-world.test.ts` (T-0095, roadmap step 15, skill `no-raw-world`). It scans `src` and the Rust crate, not only these two files. The outside-body summary (step 36) is not an exception for that JSON list.
