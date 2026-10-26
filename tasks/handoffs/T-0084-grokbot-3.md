# T-0084 handoff (grokbot-3)

Branch: `grokbot-3/empty-entity-store`. Base: `origin/main` at `bd2ef1c` (PR #129). Not self-approved. Not merged.

## Status

Claimed. `hecs` 0.10.5 is linked. The three entity tests passed. Next: the full `cargo test`, `npm test`, and `npx tsc --noEmit`, then the complete event if those pass. Not self-approved.

## What was built

`rust/boreal-sim/src/entities.rs` `EntityStore`. `lib.rs` gains `pub mod entities`. `Cargo.toml` pins `hecs = "=0.10.5"`. `Cargo.lock` records that tree. No planet-grid file, weather file, species file, or TypeScript entity list was edited.

Entity tests (`cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib entities -- --nocapture`):

```
create=8192 remove=4096 iterate=4096 create_us=1967 remove_us=597 iterate_us=118
```

`empty_world_constructs`, `handle_is_one_integer_and_fails_after_removal`, and `create_remove_iterate_counts` passed. 78 other lib tests were filtered out of that run. The six warnings are the pre-existing ones in climate seed, formation, and interior.

`cargo check --target wasm32-unknown-unknown` finished. A release build of the wasm is 142,974 bytes against the committed 141,253. The only export-name difference is `__data_end` and `__heap_base`. No entity function is exported. `public/wasm/boreal_sim.wasm` is left as it is on main, so the planet bytes the game loads do not change in this task.

## Shortlist

Compiler: rustc 1.83.0 (90b35a623 2024-11-26). No `rust-toolchain` file. Sizes are crates.io `.crate` bytes. Detail and the probe failures are in `notes/skills/adopt-ecs.md`.

| Crate | Release | Licence | Maintenance | Size | Model | Links here |
| --- | --- | --- | --- | --- | --- | --- |
| hecs | 0.11.2 current; pick 0.10.5 | MIT OR Apache-2.0 | pushed 2026-10-25 | 99,108 / 82,553 | archetype store; `to_bits` → one `NonZeroU64` | 0.11.2 no (edition 2024); 0.11.0 no (E0747); 0.10.5 yes |
| bevy_ecs | 0.20.0 | MIT OR Apache-2.0 | pushed 2026-10-26 | 784,721 | archetype store; `Entity::to_bits` → `u64` | no (`rust-version` 1.95.0) |
| legion | 0.4.0 | MIT | last push 2021-12-30 | 1,108,971 | archetype store; `Entity(NonZeroU64)` | yes, unmaintained |
| slotmap | 1.1.1 | Zlib | pushed 2026-09-04 | 61,862 | generational arena, not a component store | yes |

Pick: `hecs = "=0.10.5"`. Smallest maintained component store that links and whose handle is one integer that fails after removal.

- Takeover comment: `tasks/events/2026-10-26T12-33-00-grokbot-3-comment-T-0084.json` at 2026-10-26T12:33:00-07:00. Quotes Matthew at 12:22 PM PT. Not an approval.
- Claim: `tasks/events/2026-10-26T12-33-01-grokbot-3-claim-T-0084.json` at 2026-10-26T12:33:01-07:00, after grokbot-2's approve-plan at 2026-10-26T03:35:13-07:00.
- T-0082 ledger comment: `tasks/events/2026-10-26T12-33-02-grokbot-3-comment-T-0082.json` at 2026-10-26T12:33:02-07:00. Does not complete or approve T-0082. Pull request #128 was not edited.

## Claim check (before any edit)

- `git fetch origin --prune`. Local main was `69533d6`; `origin/main` is `bd2ef1c` ("Merge pull request #129").
- `git log --all -- tasks/T-0084-empty-entity-store.md tasks/events/*T-0084*`:
  - propose `tasks/events/2026-10-25T19-30-11-grokbot-3-propose-T-0084.json` (grokbot-3, 2026-10-25T19:30:11-07:00)
  - plan comment `tasks/events/2026-10-26T03-35-05-grokbot-2-comment-T-0084.json` (grokbot-2, 2026-10-26T03:35:05-07:00)
  - approve-plan `tasks/events/2026-10-26T03-35-13-grokbot-2-approve-plan-T-0084.json` (grokbot-2, 2026-10-26T03:35:13-07:00), merged in PR #130 (`cd652e6`)
- No claim event on any fetched branch. No `grokbot-2` branch adds an entity-store crate. `origin/grokbot-2/t0082-planet-weather`, `origin/grokbot-2/approve-plan-t0082`, and `origin/grokbot-2/reviewers` only mention T-0084 in the task file, the roadmap, and `AGENT-NOTES.md`.
- Open pull requests: only #128 (`grokbot-3/rust-climate-authority`). Not touched. No open PR names T-0084.
- `grokbot-3/rain-shadow-ocean` is not on origin. Its files stay untouched anyway: `rust/boreal-sim/src/planet_fundamentals/**`, `src/core/weather.ts`, `src/core/planetWeather.ts`, `src/core/planetBudget.ts`, `tests/planet-budget.test.ts`, `notes/skills/rust-climate-authority.md`.

## Review inventory (rule 15)

The only open pull request is #128, authored on a `grokbot-3/` branch. This run does not review, approve, edit, or close it. Nothing else is waiting on a non-author review.

## What this task will build

One component store linked from `rust/boreal-sim`, an empty world, a handle that is one integer and fails after removal, and a create/remove/iterate count benchmark. No animal behaviour, no species file, no event log, no second TypeScript entity list. Plan text in `tasks/T-0084-empty-entity-store.md` stays as grokbot-2 approved it.

## Number table

Numbers gate: N/A. This task introduces no rate, timing, density, or size of a living thing. The crate byte sizes in the shortlist are package sizes, not natural quantities.

## Frames

Frame gate: N/A. Nothing is drawn. The game picture does not change, so there is no recording.

## Needs from another agent

None yet. grokbot-1 reviews and merges. This agent does not approve its own work.
