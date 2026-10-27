# Skill: nothing sends the raw world across

Use when a payload is about to move from the simulation to the picture, or when a test should keep issue #101's JSON animal list unbuilt. T-0095 did the guard. Roadmap step 15. Issues #101, #105, and #106. #106 wins. The perception block is T-0083 (`notes/skills/perception-buffer.md`). The outside-body summary is step 36 and is not built.

## The crossing

The Rust crate `rust/boreal-sim` compiles to wasm (`cdylib`). `src/core/planetBudget.ts` instantiates it and reads `Float64Array` planes over that memory. `lib.rs` says the exports are plain `extern "C"`: numbers, or a pointer to `f64`. There is no wasm-bindgen and no serde.

The other payload that exists today is the perception block. `write_perception` in `rust/boreal-sim/src/perception.rs` writes little-endian bytes. `readPerception` in `src/core/perceptionBuffer.ts` reads them. Positions in that block are floats. They are not JSON. A later export of the block is `*mut u8` (or a view of the same wasm memory), which this guard allows.

Step 36's summary, for when you are not inside a body, is the only other payload, and it is not built. It is not a JSON list of animals. Do not allowlist it as one.

## Steps

1. Do not add a JSON list of animals (`id`, `species`, `x`, `y`, `state`) for the viewer. That is the sketch in issue #101. It was never built.
2. Do not add `serde_json`, `serde`, or `wasm-bindgen` to `rust/boreal-sim`. Do not return `*const c_char`, `CString`, or `String` from an `extern "C"` export. A string return is how that JSON would cross.
3. Do not `JSON.stringify` an `animals` list, a `world`, or `entities` in `src`. Do not `JSON.parse(...).animals`.
4. The crossing modules `src/core/planetBudget.ts`, `src/core/planetWeather.ts`, and `src/core/perceptionBuffer.ts` do not call `JSON.stringify` at all.
5. Run `tests/no-raw-world.test.ts`. It walks `src/**/*.ts`, `rust/boreal-sim/**/*.rs` (including the CLI bins), and `Cargo.toml`.

## Allowlist

`ALLOWLIST` in `tests/no-raw-world.test.ts` is empty. A path is added only when the scanner hits it and the hit is still a save or an evidence file. The list only shrinks: a listed path that no longer hits fails the test. Say, in the `why` field, which call it is and why it is not a viewer payload.

These are scanned and are not hits, so they are not listed:

- Saves: `saveWeather`, `saveClock`, `saveGround`, `saveDeltas`, and `JSON.stringify` of the interaction context in `src/main.ts`. They persist the clock, the near weather column, the delta log, and remembered interactions.
- CLI bins `rust/boreal-sim/src/bin/form.rs` and `hot.rs` write a figure JSON (`n`, `mass`, `j2`) next to a bake `.bin`. They are not linked into the wasm the viewer loads.
- `formation.rs` reads `data/earth/materials.json` with `include_str!`. That is a materials table.
- In-memory `animals:` fields on `SimWorld`, `SoundFrame`, and `sfx.update` stay on the JavaScript heap. They are not serialized for the viewer.

`tests/`, `tools/`, `tasks/`, `notes/`, `refs/`, and `data/` are outside the walk. Evidence writers and board events are JSON on purpose. They are not the viewer.

## Checks that prove it worked

- The fixture copied from issue #101 (`animals` with `id`, `species`, `x`, `y`, `state`, then `JSON.stringify`) is a hit.
- `JSON.stringify(animals)`, `JSON.stringify(world)`, a quoted `"animals"` key, `JSON.parse(raw).animals`, `serde_json::to_string`, and an `extern "C"` return of `*const c_char` are hits.
- `saveWeather`, `saveClock`, `JSON.stringify(context)`, `saveDeltas`, the deep-time id `'animals'`, `return { animals: [] }`, `sfx.update({ animals })`, a stats `JSON.stringify(out)`, a perception float `.x`, `*mut u8`, and `include_str!` of the materials table are not hits.
- The live walk's fresh hits are empty, and every allowlist path still hits. Both are true when the allowlist is empty and the tree is clean.
- `npx tsc --noEmit` and `npm test` pass. Numbers N/A: no new rate or size. Frame N/A: nothing is drawn.

## Mistakes to avoid

- Flagging every `JSON.stringify`. Saves, probe results, and debug stats are JSON and are not the world list. Match the animals list, the raw-world value, or a stringify inside a crossing module.
- Putting the CLI figure JSON or the materials table on the allowlist when they do not hit. An allowlist entry that does not hit fails the test.
- Treating the in-memory sim (`src/core/sim`) as already across the boundary. The picture reads it in-process. Serializing it as JSON would be the violation.
- Allowing step 36 to be issue #101's list under another name. The summary is a different reading. It is not this JSON.
- Scanning `tests/` and then allowlisting the fixture that is supposed to fail. The fixture is a string inside the test, and the walk does not enter `tests/`.
- Returning the perception block as a JSON string. It is bytes. `*mut u8` stays legal.
