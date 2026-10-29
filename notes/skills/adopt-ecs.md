# Skill: adopt one entity store

Use when the simulation needs a component store, or when a later step adds a component to the store this task linked. T-0084 did the first link: an empty world, a handle that fails after removal, and no behaviour. Roadmap step 11. Issues #101, #117, #118, and #119.

## Steps
1. Shortlist the current release of each candidate before picking. For each one record the licence, the maintenance signal (crates.io publish date and the repository's last push), the published `.crate` size, and the model (archetype component store, or a generational arena that is not a component store). Rule 11 asks for that record. Write it in `AGENT-NOTES.md`.
2. Compile the candidate on this repo's compiler. `rustc --version` in this workspace is 1.83.0, and the repo has no `rust-toolchain` file. A crate whose `rust-version` is higher, or whose dependency needs `edition2024`, does not link here. A crate that declares an older `rust-version` can still fail to compile. The failure is part of the shortlist.
3. Prefer the smallest candidate that is a real component store, is still maintained, links, and gives a handle that fails a lookup after removal and fits in one integer. Do not invent a store. A generational arena such as `slotmap` is the pattern for that handle, not the store itself.
4. Link it from `rust/boreal-sim` with a one-line module in `lib.rs` and a pinned version in `Cargo.toml`. Keep the planet-grid files out of the edit. Do not add a wasm export for the store until a later step reads it. Do not rebuild `public/wasm/boreal_sim.wasm` unless a release build for `wasm32-unknown-unknown` actually changes the bytes the game loads.
5. Prove three things with `cargo test --manifest-path rust/boreal-sim/Cargo.toml`:
   - `hecs::World::new` (or the picked store's empty constructor) has length 0.
   - A handle is one `u64`. After `despawn`, `contains` is false. Spawning again may reuse the index. The old integer stays false because the generation changed.
   - A count benchmark creates N entities, removes every other one, and iterates. The test asserts create, remove, and iterate. Run it with `-- --nocapture` and copy the `create= remove= iterate=` line into the handoff.
6. Do not port `AnimalBrain` or `agent.ts`. Do not add a species file. Do not build issue #119's event log. Do not add a second entity list in TypeScript. Drives from issue #117 are components on this store in a later step.

## The T-0084 shortlist

Compiler: rustc 1.83.0 (90b35a623 2024-11-26). Sizes are the published `.crate` bytes from crates.io.

| Crate | Release | Licence | Maintenance | Size | Model | Links on 1.83.0 |
| --- | --- | --- | --- | --- | --- | --- |
| hecs | 0.11.2 (2026-10-04); 0.10.5 is the newest that links | MIT OR Apache-2.0 | repo pushed 2026-10-25; badge actively-developed | 0.11.2 is 99,108 bytes; 0.10.5 is 82,553 | archetype component store; `Entity::to_bits` is one `NonZeroU64` (`src/entities.rs` line 44 in 0.10.5) | 0.11.2 no (hashbrown 0.17.1 needs edition 2024). 0.11.0 no (`world.rs:521` E0747, const generic `_` not inferred). 0.10.5 yes |
| bevy_ecs | 0.20.0 (2026-10-08) | MIT OR Apache-2.0 | repo pushed 2026-10-26 | 784,721 bytes, plus bevy_platform, bevy_utils, slotmap, and the rest of a 27-dependency list | archetype component store; `Entity::to_bits` returns `u64` (`src/entity/mod.rs` line 566) | no; `rust-version = "1.95.0"` |
| legion | 0.4.0 (2021-02-25) | MIT | last push 2021-12-30 | 1,108,971 bytes, plus rayon, serde, uuid, syn | archetype component store; `Entity` is `NonZeroU64` (`src/internals/entity.rs` line 19); `World::remove` then `entry` is `None` (`src/internals/world.rs` lines 260 and 307) | yes, and unmaintained |
| slotmap | 1.1.1 (2025-12-06) | Zlib | repo pushed 2026-09-04 | 61,862 bytes, no required dependency | generational arena, not a component store; `KeyData::as_ffi` returns `u64` (`src/lib.rs` line 283) and a removed key fails `contains_key` | yes, and not the store |

Pick: `hecs` `=0.10.5`. It is the smallest maintained component store that links. `slotmap` is smaller and is only the arena pattern. `legion` links and is larger and unmaintained. `bevy_ecs` 0.20.0 does not link.

Resolved runtime crates for the pick, from `cargo tree` on 0.10.5: hecs 0.10.5, hashbrown 0.14.5 (141,498 bytes), ahash 0.8.12 (43,413), spin 0.9.9 (39,817), once_cell 1.21.4 (35,010), zerocopy 0.8.63 (333,272), cfg-if 1.0.5 (9,578). That tree is still smaller than `bevy_ecs` alone or `legion` alone.

## Checks that prove it worked
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities -- --nocapture` prints `create=8192 remove=4096 iterate=4096` and passes `empty_world_constructs`, `handle_is_one_integer_and_fails_after_removal`, and `create_remove_iterate_counts`.
- `cargo check --target wasm32-unknown-unknown --manifest-path rust/boreal-sim/Cargo.toml` still finishes. The planet exports in `lib.rs` are unchanged.
- `npx tsc --noEmit` and `npm test` pass. No species file was added. `src/` has no new entity list.
- Numbers gate: N/A. No rate was introduced. Frame gate: N/A. Nothing is drawn.

## Mistakes to avoid
- Taking the current `hecs` 0.11 line because the badge says maintained, then discovering `cargo test` fails on rustc 1.83. Pin the release that linked, and say why the newer ones did not.
- Picking `slotmap` because it is the smallest crate in the shortlist. It does not store components. Issue #117's drives need a component store later.
- Picking `legion` because it happens to compile. Its last release is 2021-02-25.
- Packing the handle as a struct of two integers, or as JSON. Issue #119 stores one integer. `to_bits().get()` is that integer. `from_bits(0)` is `None`.
- Treating a reused index as the same entity. The test must spawn after remove and assert the old `u64` is dead.
- Porting animal behaviour, adding a species file, or writing the event log in this step.
- Editing `planet_fundamentals` or the weather files while another branch owns them. The store is a new module.
