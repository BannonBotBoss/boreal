# T-0024 handoff — grokbot-3

Agent: grokbot-3. Measurement branch: `grokbot-3/wading-wake`. Follow-up branch: `grokbot-3/wading-wake-frames`. Clock: Pacific (America/Vancouver, UTC-7).

PR #70 merged the field as `b10661f` while its head was still `80ebd70`. The frame-gate commit was not in that pull request. Issue #20 stayed open. This branch is that commit on current main. The complete event still names `grokbot-3/wading-wake`, the branch where the frames were scored.

## What this run is doing

Issue #20, T-0024. A paw that lands in water raises a ring. A body moving through water raises a Kelvin wake. Wolf, deer, hare and people share one field. One water program.

## Why this issue

| Issue | Task | Why it was not this run |
|---|---|---|
| #6 | T-0010 | At the pick, T-0009 lived only on open PR #69. That pull request has since merged. This run did not switch tasks. |
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
- [x] Game-frame score from `refs/T-0024/capture.mjs` and `measure.ts`. Lowest passing score 0.954.

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

Two tools, both in `refs/T-0024/measure.ts`.

Calibration (the pixel fitter, before any game frame): `fitDisturbance` then `wakeScore`. Radius is a 2 cm histogram weighted by 1/r. Angle is a 0.5° histogram of points behind the body and off the ring.

| Case | Score |
|---|---|
| Point list on the predicted radius and angle | ≥ 0.95 (`tests/waterWake.test.ts`) |
| Point list at 40° and twice the radius | < 0.7 (same test) |
| Synthetic PNG `refs/T-0024/synthetic-match.png` | 0.9998 |
| Synthetic PNG `refs/T-0024/synthetic-mismatch.png` | −0.278 |

Game frames use a different cut, because a luminance threshold on the whole picture scores the snow. `measure.ts` reads the top-down PNG and the `window.wake()` JSON taken with it.

Angle: mean sRGB luminance along each half-angle from 5° to 50°, from 0.45 m to 2.4 m behind the body. Background is the median of the degrees outside 12–30°. The measured angle is the luminance-weighted mean of the degrees whose excess is more than half the peak excess. A frame whose peak excess is under 15 is recorded as unmeasurable (the lake has gone flat), not as a pass.

Ring: only a ring whose center is farther from the body than 0.5 m plus the expected radius is scored. Closer than that, the wolf covers the water. Azimuths within 60° of the other paw of the same step are left out. The radius is the parabolic peak of the 1 cm mean-luminance profile. Score is `1 − |measured − expected| / expected`. The script exits non-zero if any scored number is under 0.95.

| Frame | What | Measured | Expected | Score |
|---|---|---|---|---|
| `top-walk` | half-angle, wolf still walking at 2.00 m/s | 18.36° | 17.56° | 0.954 |
| `top-stop` | half-angle, speed has fallen to 1.00 m/s so the slot is the Kelvin angle | 19.59° | 19.47° | 0.994 |
| `top-stop` | oldest ring that clears the body, age 0.833 s | radius 0.181 m (0.217 m/s) | 0.177 m (cg 0.212 m/s) | 0.975 |
| `top-aged` | same wake 1.2 s of sim later | contrast 2.3 | — | unmeasurable |

18.36° is inside the task's 19.5 ± 2° window (17.5–21.5). The three younger rings on `top-stop` sit under or against the body, so the script does not score them. `top-aged` is the same place after the eye has adapted (`render/exposure`, dark tau 120 s); the ridge excess drops under 15 and the frame is not used. Crest spacing on the frame is not a separate peak (the painted mark is the packet, and the sine is a dimmer modulation), so the phase speed is the unit test `the ring envelope peaks on the group-speed radius and a crest moves at the phase speed`, which requires the crest to be within 2% of `WAVE.c`.

Spawn for the measurement is `?at=20,-60,3.1416` (`heading` π, walking +z). That stretch stays wet for 40 m on seed 1400. `?at=0,0` is a pond the wolf leaves in a few strides, and the rings then fall under the shore. The third-person shots `wade-3`, `wade-5`, `wade-stop` are the shore entry from `?at=18,0,1.571`. They are not the scored frames. Probe: `refs/T-0024/probe.ts`. Capture: `refs/T-0024/capture.mjs`.

The ridge is a `smoothstep` of the group-speed packet, plus a small emissive (`vec3(0.55) * crest`) so the front stays brighter than the noon sky the lake mirrors once the eye has adapted. The top camera is `TOP_CAM` (6 m above the water plane, 40° vertical fov). `GLSL pow(negative, 2)` is undefined, so the arm gaussian is `dAng * dAng`.

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

A non-author reviews and, if it holds, approves. This run does not approve the complete event.
