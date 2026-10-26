# T-0083 handoff (grokbot-3)

Branch: `grokbot-3/perception-buffer`. Not merged. Not self-approved. Claimed and complete. Waiting on a non-author approve.

## Status

Implementation is on the branch, commit `24f0a52`, pull request https://github.com/BannonBotBoss/boreal/pull/131. Main was merged in at `d974a89` (normal merge, no conflicts). That merge brought grokbot-1's approve-plan from pull request #132 (`d9c39d5` on main). Claim and complete are on this branch. grokbot-3 does not approve or merge this pull request.

## Approval

T-0083 was proposed by grokbot-3 (`tasks/events/2026-10-25T19-30-10-grokbot-3-propose-T-0083.json`). grokbot-1 approved the plan (`tasks/events/2026-10-26T05-20-51-grokbot-1-approve-plan-T-0083.json`, `at` 2026-10-26T05:20:51-07:00), merged to main through pull request #132 at 2026-10-26 05:34 AM PT.

Matthew, 2026-10-24 17:10 PT: "every 30 minutes, check the issues and get one done". Matthew, 2026-10-26 2:43 AM PT: "focus on boreal". Neither sentence names T-0083 or the perception buffer. Those remarks are not the approval. The approval is grokbot-1's approve-plan.

Claim: `tasks/events/2026-10-26T05-54-grokbot-3-claim-T-0083.json` at 2026-10-26T05:54:37-07:00, after the approve-plan. Complete: `tasks/events/2026-10-26T05-55-grokbot-3-complete-T-0083.json` at 2026-10-26T05:55:04-07:00. Skill named: `perception-buffer` (`notes/skills/perception-buffer.md`). The finished work still needs a non-author approve.

## What was built

One contiguous little-endian block of what the embodied animal perceives. Nothing is drawn.

- Writer: `rust/boreal-sim/src/perception.rs` `write_perception` / `pack`. Wired as `pub mod perception` in `lib.rs`. No new wasm export, so the planet grid layout is unchanged.
- Reader: `src/core/perceptionBuffer.ts` `readPerception`. It accepts a view of wasm memory or any other slice.
- Shared frames: `tests/fixtures/perception-empty.bin` (176 bytes) and `tests/fixtures/perception-known.bin` (392 bytes). Regenerated only by `PERCEPTION_DUMP=1 cargo test --manifest-path rust/boreal-sim/Cargo.toml --lib perception`.
- Skill: `notes/skills/perception-buffer.md`.

Order, from issue #106: header (64), body feelings (32), emotions (32), urges (32), visible things (48 each), scent volumes (32 each), sounds (28 each), memory marks (20 each), then any bytes a later sense appends.

Packing, from the issue's offset table (roadmap conflict 19), not from `#[repr(C)]`:

| Field | Offset or stride | Check |
| --- | --- | --- |
| Embodied id | byte 20 | known fixture `0x8877665544332211`; species `u32` ends at byte 20 |
| Hunger | byte 64 | first body feeling |
| Fear | byte 96 | first emotion |
| Header reserved tail | bytes 44..64 | 20 bytes on every frame, including zero counts |
| Sound | 28 | fields sum to 24; last 4 are reserved |
| Scent | 32 | issue states 32; fields sum to 28; last 4 are reserved |
| Memory | 20 | fields already sum to 20; no extra tail |
| Caps | 32 visible, 16 scents, 8 sounds, 12 memories | a 33rd visible thing is an error |

Counts may be zero. The empty fixture has every count at zero, the 20-byte header tail, the body and emotion reserved floats, and 16 bytes after the fixed block. A later sense appends after the memory marks. The reader returns that tail and does not move byte 20.

Issue #105's nested structs and issue #101's JSON list are not built. The perception sources do not call `JSON.stringify` or `serde_json`.

## Number table

Numbers gate: N/A. These sizes are issue #106's layout, not physical constants. No new game number was introduced. The floats in the fixtures are layout sentinels (1, 9, 17, 120, 0.75), not animal measurements.

| Value | Game | Real figure | Source | Match |
| --- | --- | --- | --- | --- |
| Header | 64 bytes, embodied id at 20 | the issue's offset table | issue #106 | yes |
| Sound entry | 28 bytes, 4 reserved | the issue states 28; fields sum to 24 | issue #106, conflict 19 | yes |
| Memory entry | 20 bytes | the issue states 20; fields sum to 20 | issue #106, conflict 19 | yes |
| Scent entry | 32 bytes, 4 reserved | the issue states 32; fields sum to 28 | issue #106 | yes |
| Caps | 32 / 16 / 8 / 12 | the issue's per-frame example | issue #106 | yes |

## Frames

Frame gate: N/A. Nothing is drawn. There is no screen recording.

## Evidence a reviewer can spot-check

1. Known fixture byte 20 is the embodied id, and byte 16 is the species, so the id is not padded to 24. `tests/perception-buffer.test.ts` and `perception::tests::header_offsets_match_issue_106`.
2. The second sound's category is 28 bytes after the first, and the 4 bytes before it are `AA BB CC DD`.
3. The second memory's type is 20 bytes after the first.
4. Empty fixture: counts at bytes 28, 32, 36, and 40 are zero, byte 44 is `E0`, and the block is still 176 bytes.

## How to verify

Recorded on this branch after `24f0a52`:

- `npx tsc --noEmit` exit 0.
- `npm test`: 813 tests, 799 pass, 0 fail, 14 todo. The six `T-0083` tests passed, including embodied id at byte 20, the 28-byte sound, the 20-byte memory, zero counts, and no JSON.
- `cargo test --manifest-path rust/boreal-sim/Cargo.toml`: 78 passed, 0 failed. The four perception tests passed. The six warnings are the pre-existing unused items in climate seed, formation, and interior.

Re-run on 2026-10-26 after merging main (`d974a89`), with the claim and complete events in the tree: same results. `npx tsc --noEmit` exit 0. `npm test` 813 tests, 799 pass, 0 fail, 14 todo. `cargo test --manifest-path rust/boreal-sim/Cargo.toml` 78 passed, 0 failed, with the same six pre-existing warnings.

Comment, not an approval: `tasks/events/2026-10-26T03-43-34-grokbot-3-comment-T-0083.json`.

Claim and complete, this run (Pacific clock `TZ=America/Vancouver date`):

- `tasks/events/2026-10-26T05-54-grokbot-3-claim-T-0083.json` at 2026-10-26T05:54:37-07:00
- `tasks/events/2026-10-26T05-55-grokbot-3-complete-T-0083.json` at 2026-10-26T05:55:04-07:00

The complete event cites the evidence already on pull request #131: the tests, the shared frames `tests/fixtures/perception-empty.bin` and `tests/fixtures/perception-known.bin`, and `notes/skills/perception-buffer.md`. Numbers gate: N/A. Frame gate: N/A.

## Rule 15

This run's instruction is to bring pull request #131 up to date after the approve-plan landed. It does not review other open pull requests and it does not approve T-0083. `rustfmt` was not run on the existing crate.

## Needs from another agent

A non-author approve of the finished work, then merge. grokbot-1 said they would approve and merge once the claim and complete events are on the branch. Do not merge this branch from here. Do not self-approve.
