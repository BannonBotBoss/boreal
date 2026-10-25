# T-0024 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/wading-wake`. Clock: Pacific (America/Vancouver, UTC-7).

## What this run is doing

Issue #20, T-0024. A paw that lands in water raises a ring. A body moving through water raises a Kelvin wake. Wolf, deer, hare and people share one field. One water program.

## Why this issue

| Issue | Task | Why it was not this run |
|---|---|---|
| #6 | T-0010 | Depends on the shared agent core, T-0009, which is only on open PR #69 (`grokbot-3/agent-core-hare`). Not stacked. |
| #7 | T-0011 | Same dependency on T-0009. No claim. Not stacked. |
| #8 | T-0012 | Same. |
| #9 | T-0013 | Same. |
| #10 | T-0014 | Same. |
| #11 | T-0015 | Same. |
| #13 | T-0017 | Depends on T-0010, which is not on main. |
| #14 | T-0018 | Depends on T-0013. |
| #15 | T-0019 | Depends on T-0014. |
| #16 | T-0020 | Depends on T-0007 / the same unmerged chain. |
| #17 | T-0021 | Claimed and completed by grok (2026-10-23). Not redone. |
| #18 | T-0022 | Claimed by codex (2026-10-21). |
| #20 | T-0024 | Taken. Approved by grok (2026-10-21T12:14:20-07:00), who is not the author. No second approve-plan: the ledger only accepts one while the task is still proposed. The contact bus it names is already on main (`src/core/contactBus.ts`). |

The general "get one done" line from Matthew (2026-10-24 17:10 PT) is why this run is working. It is not a task-specific approve-plan. Grok's approve-plan is the one the claim sits on.

## Done

- [x] Claim `tasks/events/2026-10-24T22-17-21-grokbot-3-claim-T-0024.json` at 2026-10-24T22:17:21-07:00.
- [x] `src/core/waterWake.ts`, the shared shader in `src/render/water.ts` (program key `boreal-water-wake`), player / deer / hare / person call sites, `?top=1` measure camera.
- [x] `tests/waterWake.test.ts`. Skill `notes/skills/water-wake.md`.
- [ ] Game-frame score filled in below after `refs/T-0024/capture.mjs` and `measure.ts`.

## Number table

`g` is `gravity()` (9.820 m/s² at altitude 0). λ = 0.10 m. σ = 0.07275 N/m (IAPWS R1-76, 20 °C). ρ = 998.2071 kg/m³ (Tanaka et al. 2001). ν = 1.0034e-6 m²/s (Kestin, Sokolov & Wakeham 1978).

| Quantity | This build | Band in the task |
|---|---|---|
| Phase speed c | 0.401 m/s | 0.30–0.69 for 5–30 cm |
| Group speed cg | 0.212 m/s | 0.18–0.35 |
| Capillary-gravity minimum | near 0.23 m/s, λ between 1.2 and 2.5 cm (scanned in the test) | 0.23 m/s at 1.7 cm |
| Kelvin half-angle | 19.471° | 19.47° |
| Wolf at the game walk, 2 m/s, L = 1.325 m | Fr 0.554, half-angle 17.56° | 19.5 ± 2° (17.5–21.5). The task's 1.5 m/s example is not the game's walk speed. |
| Crest cap ak = 0.3 | 4.77 mm. A walking wolf's paw hits the cap. | below the Stokes limit |

The wolf waterline is the Wikipedia "Wolf" head-and-body midpoint, 105–160 cm, the page `wolfBody.ts` already cites. The hip span (0.54 m) would push Fr high enough to leave the ±2° window. Deer L is the rig wheelbase `DEER_HIP_XZ` (1.30 m). Hare L is the ADW head-body midpoint already in `animals/hare.ts` (0.42 m). Bear L is the `BEAR_LEG_XZ` fore-to-hind span (0.95 m).

Viscous decay does not fade a 10 cm wave in a few seconds. The ring the eye follows is the packet `exp(−((r − cg t)/λ)²)`. The wake's time fade is `exp(−age · cg / L)`, so it is down by 1/e after the group has travelled one body length. The test checks that ratio.

## Frame gate

Metric: `fitDisturbance` then `wakeScore` in `src/core/waterWake.ts`. Radius is a 2 cm histogram weighted by 1/r (a filled ring has more pixels on the outside). Angle is a 0.5° histogram of points behind the body and off the ring.

| Case | Score |
|---|---|
| Point list on the predicted radius and angle | ≥ 0.95 (`tests/waterWake.test.ts`) |
| Point list at 40° and twice the radius | < 0.7 (same test) |
| Synthetic PNG `refs/T-0024/synthetic-match.png` | 0.9998 |
| Synthetic PNG `refs/T-0024/synthetic-mismatch.png` | −0.28 |
| Game `?top=1` frames | filled by `refs/T-0024/measure.ts` after capture |

`?at=30,0` is dry ground on seed 1400 (height about 1.5 m). Open water at the base plane is around 0,0 (ground about −1.6 m, water −0.25 m). The shore used for the third-person wade is x=18, z=0, heading 1.571, walking toward −x into water near x=12. Probe: `refs/T-0024/probe.ts`.

The painted ridge is a narrow `smoothstep` of the group-speed packet, so the white pixels sit on the front. Crests stay in the height and as a dimmer modulation. The top camera is `TOP_CAM` (6 m above the water plane, 40° vertical fov).

## Budget

Eight ring slots and eight wake slots. No extra draw call and no extra triangles: one material, program key `boreal-water-wake`. The CPU test samples `field()` 2000 times and requires under 100 ms. That case ran in about 9 ms.

## Paths

- `src/core/waterWake.ts`
- `src/render/water.ts`
- `src/main.ts` (player step, snapshot, `window.wake` when the query has `bench`, `top` or `wake`)
- `src/render/buildScene.ts` (deer, people, top camera)
- `src/render/animalRig.ts` (`DEER_HIP_XZ`)
- `src/animals/hare.ts` (hop clock)
- `tests/waterWake.test.ts`
- `notes/skills/water-wake.md`
- `refs/T-0024/`

## Needs from another agent

A review. This run does not approve its own complete event. Grok's approve-plan already covers the claim.

## Exact next step

Capture `?top=1` at `at=0,0,0` and the shore wade, run `measure.ts`, and write the game-frame score into this file. Do not mark the task complete if that score is under 95%.
