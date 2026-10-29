# T-0084 handoff (grokbot-3)

Branch: `grokbot-3/empty-entity-store`. Base: `origin/main` at `bd2ef1c`. Pull request https://github.com/BannonBotBoss/boreal/pull/135. Claimed and complete. Not self-approved. Not merged.

## Status

The empty entity store is linked and the gates that apply have passed. grokbot-1 reviews and merges. grokbot-3 does not approve this work.

## Approval and takeover

T-0084 was proposed by grokbot-3 (`tasks/events/2026-10-25T19-30-11-grokbot-3-propose-T-0084.json`). grokbot-2 widened the shortlist and added the stable-handle and no-event-log objectives (`tasks/events/2026-10-26T03-35-05-grokbot-2-comment-T-0084.json`), then approved the plan (`tasks/events/2026-10-26T03-35-13-grokbot-2-approve-plan-T-0084.json`, `at` 2026-10-26T03:35:13-07:00, merged in pull request #130). The plan text was not rewritten.

Matthew Bannon, 2026-10-26 12:22 PM PT, said grokbot-2 is down for 2 days and told grokbot-3: "take over the work that is needed to move the project forward". That is recorded as a grokbot-3 comment, not an approval: `tasks/events/2026-10-26T12-33-00-grokbot-3-comment-T-0084.json` at 2026-10-26T12:33:00-07:00.

Claim: `tasks/events/2026-10-26T12-33-01-grokbot-3-claim-T-0084.json` at 2026-10-26T12:33:01-07:00, after the approve-plan. No grokbot-2 branch had an implementation to build on.

## Claim check

- `git fetch origin --prune`. `origin/main` is `bd2ef1c`.
- `git log --all` on the task file and `tasks/events/*T-0084*` showed only the propose, grokbot-2's plan comment, and grokbot-2's approve-plan. No claim until this branch.
- Open pull requests at the start: only #128 (`grokbot-3/rust-climate-authority`). Not edited and not closed.
- `grokbot-3/rain-shadow-ocean` was not on origin. Its files were not edited: `rust/boreal-sim/src/planet_fundamentals/**`, `src/core/weather.ts`, `src/core/planetWeather.ts`, `src/core/planetBudget.ts`, `tests/planet-budget.test.ts`, `notes/skills/rust-climate-authority.md`.

## Review inventory (rule 15)

The only open pull request before this one was #128, on a `grokbot-3/` branch. This run did not review, approve, edit, or close it.

## What was built

One component store, `hecs` 0.10.5, linked from `rust/boreal-sim`. An empty world constructs. Nothing acts.

- Pin: `rust/boreal-sim/Cargo.toml` lines 19–21, `hecs = "=0.10.5"`.
- Module: `rust/boreal-sim/src/lib.rs` line 28, `pub mod entities`.
- Store: `rust/boreal-sim/src/entities.rs`. `Handle` is a `u64` (line 14). `spawn` stores `Entity::to_bits().get()` (line 36). `alive` is `World::contains` after `Entity::from_bits` (lines 48–51).
- Skill: `notes/skills/adopt-ecs.md`.
- Note: `AGENT-NOTES.md`, entry "2026-10-26 12:40 PT".

No species file. No port of `AnimalBrain` or `agent.ts`. No event log. No new TypeScript module. `git diff origin/main --stat` does not touch `src/`.

`public/wasm/boreal_sim.wasm` is the file already on main. A local release rebuild was 142,974 bytes against the committed 141,253. The only export-name difference was `__data_end` and `__heap_base`. No entity function is exported. `cargo check --target wasm32-unknown-unknown --manifest-path rust/boreal-sim/Cargo.toml` finished, so the crate still links for the wasm target.

## Number table

Numbers gate: N/A. This task introduces no rate, timing, density, or size of a living thing. The crate sizes below are published package sizes, not natural quantities.

| Value | Game | Real figure | Source | Match |
| --- | --- | --- | --- | --- |
| (none) | no new animal rate | not applicable | this task adds no rate | N/A |

## Frames

Frame gate: N/A. Nothing is drawn. There is no screen recording. The game picture is unchanged, so no in-game screenshot was captured.

## Evidence a reviewer can spot-check

1. Shortlist and pick. `notes/skills/adopt-ecs.md` (the table under "The T-0084 shortlist") and `AGENT-NOTES.md` (2026-10-26 12:40 PT). Current `hecs` 0.11.2 does not link: hashbrown 0.17.1 needs Cargo edition 2024, and this compiler is rustc 1.83.0. `hecs` 0.11.0 fails at `world.rs:521` with E0747. `bevy_ecs` 0.20.0 declares `rust-version = "1.95.0"` (`Cargo.toml` line 14 of that crate). `legion` 0.4.0 links and its last GitHub push is 2021-12-30. `slotmap` 1.1.1 links and its readme describes a key map, not components (`KeyData::as_ffi` at `src/lib.rs` line 283). The pick is the pin at `rust/boreal-sim/Cargo.toml:21`.
2. Empty world. `rust/boreal-sim/src/entities.rs:66` `empty_world_constructs` asserts `hecs::World::new` length 0 and `EntityStore::empty` length 0.
3. Stale handle, one integer. `entities.rs:77` `handle_is_one_integer_and_fails_after_removal` asserts the handle is a `u64`, `alive` is false after `remove`, and a respawned slot keeps the index (`as u32`) while the old integer stays dead.
4. Count benchmark. `entities.rs:98` `create_remove_iterate_counts`. Command: `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities -- --nocapture`. Output: `create=8192 remove=4096 iterate=4096 create_us=1967 remove_us=597 iterate_us=118`.
5. Full Rust suite. `cargo test --manifest-path rust/boreal-sim/Cargo.toml`: 81 passed, 0 failed. The six warnings are the pre-existing ones in climate seed, formation, and interior.
6. TypeScript. `npx tsc --noEmit` exit 0. `npm test`: 835 tests, 821 pass, 0 fail, 14 todo. The board todo is still "28 legacy rule breaks". `npx tsx tools/tasks.ts` shows T-0084 claimed by grokbot-3. The header credits stay 72. The ledger still prints 108 because `tools/tasks.ts` computes the formula (10 × 6 × 1.8) until it reads the header. That file was not changed.

What each finding became: the shortlist became the `hecs` 0.10.5 pin and the three tests. `bevy_ecs`, `hecs` 0.11, `legion`, and `slotmap` became rows in the skill, not dependencies. No new task was filed. No rule text was changed.

## T-0082 ledger gap

Separate comment, not an approval and not a complete: `tasks/events/2026-10-26T12-33-02-grokbot-3-comment-T-0082.json` at 2026-10-26T12:33:02-07:00. T-0082 reached main in pull request #129 (merge `bd2ef1c`, GitHub `mergedAt` 2026-10-26T19:15:38Z, 12:15 PM PT). grokbot-2's approve-plan and claim are on main. A complete event and a non-author approve event are not. Pull request #128 was not edited.

## How to verify

On `grokbot-3/empty-entity-store` at the complete commit:

- `cargo test --manifest-path rust/boreal-sim/Cargo.toml` — 81 passed, 0 failed.
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities -- --nocapture` — the create/remove/iterate line above.
- `npx tsc --noEmit` — exit 0.
- `npm test` — 835 tests, 821 pass, 0 fail, 14 todo.

## Needs from another agent

grokbot-1: review pull request #135 and merge it. The plan is already approved. This agent does not record `agent-review` on its own branch.

No reference image or screen recording is needed. Frame gate is N/A.

## Leftovers

- Step 12 (animals live in the store) and, through it, steps 13, 14, 17, and 18 still wait. Drives (#117) are not components yet. The event log (#119) is not built.
- T-0082 is still claimed on the ledger, without a complete or a non-author approve. This branch only notes that.
- The committed wasm does not contain the store. The first step that calls it from the page should rebuild `public/wasm/boreal_sim.wasm`.
