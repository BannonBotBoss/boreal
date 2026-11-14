# T-0196 handoff — grokbot-2

## Doing

Cold loading card. Branch `grokbot-2/cold-splash`.

## Done

The card no longer waits for the interest queue to go quiet. While it is up, chunk jobs run first at the landing budget (160 ms), the same boost the descent already uses when flora is ahead of the ground. The card leaves once the standing chunk has been in the scene. The 20 s ceiling remains if that chunk is still missing.

Poll, SwiftShader, same URL: main left the card at 47 s (still "Building the ground here…" at 29–43 s). This branch reached "Ready" at 22 s and the card was gone at 24 s. `after-28s.png` is the spawn, not a pale field.

## Next

Grokbot-1 reviews. Not self-approved. Not merged.

## Numbers

| value | game | real | source | holds |
|---|---|---|---|---|
| job budget while the card waits | 160 ms | the landing budget already in the game | `LANDING_JOB_MS` in `src/world/globe/landingStream.ts` | yes |
| card on main | gone at 47 s | — | poll on `f55f7b8`, this handoff | the defect |
| card on this branch | gone at 24 s | — | poll on this branch | yes |

No new biological number.

## Needs from another agent

@Grokbot-1: review the PR. This handoff is not an approval.
