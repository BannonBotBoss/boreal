# T-0004 handoff (grokbot-3)

Branch: `grokbot-3/surface-bands` off main `71d5c46`. Agent: grokbot-3. Issue: https://github.com/BannonBotBoss/boreal/issues/1

## Doing
Task left open. Code, tests, skill and the SwiftShader stills are on the branch. The numbers gate and the frame gate do not pass. No complete event.

## Done
- Handoff created first and committed (`1e5613e`) before the claim and before code.
- Claim: `tasks/events/2026-10-24T18-39-23-grokbot-3-claim-T-0004.json` at `2026-10-24T18:39:23-07:00`, after claude's approve-plan `2026-10-20T16:45:00-07:00`.
- Housekeeping comment (not a second renumber): `tasks/events/2026-10-24T18-39-37-grokbot-3-comment-T-0071.json`. Main has two T-0071 task files. Open PR #61 already renumbers the orphan file to T-0076. This branch does not take T-0076 again. PRs #60 and #64 hold T-0074 and T-0075. Next free id is T-0077. No new task was needed.
- `src/render/bands.ts`: `wantsBands`, `applySurfaceBands`, one chunk before `#include <alphamap_fragment>`, `GLSL_NOISE` only (`vnoiseU`, `fbm`). Key is `prev + '|bands'`. `render/batch` calls it before `fadeOptIn`. Trees keep `userData.bandsMask = '(1. - step(0.5, vLeaf))'`. `?bands=0` off. `?bands=<amp>` sets the half-range when `0 < amp <= 0.5`.
- Default on/off: Matthew's decision. The spec says ON on the preview branch. This branch leaves it ON unless `?bands=0`. It does not flip the shipped default to off.
- Default contrast: the plan's 0.85–1.15 (`BANDS_AMP_DEFAULT` 0.15). The copy that was already on main used 0.30 (0.70–1.30) so the preview would read. That was wider than the plan. `?bands=0.3` still selects the old half-range.
- Opt-outs left in place: `LOG_MATERIAL` (T-0005 bark), `ROCK_MATERIAL` (T-0026 mineral bands), wolf rig `userData.noBands`. Terrain is not passed through `render/batch` and `render/pbr.ts` does not call `applySurfaceBands`. Animals are not batched.
- `tests/bands.test.ts` (4 tests) passed locally: selection, shared key, one noise paste, bark mask, fade keeps `|bands`, query switch, cycle lengths, wiring.
- Skill: `notes/skills/surface-bands.md`. Task header `skill: surface-bands`. `AGENT-NOTES.md` has the 2026-10-24 18:39 PT entry.
- Objectives stay unchecked. The numbers gate is not a yes, and the omen frame gate is not run.

## Numbers gate (rule 6)
Tool: `bandCycleM` and `BANDS_AMP_DEFAULT` in `src/render/bands.ts`, locked by `tests/bands.test.ts`. Not a frame measurement.

| Value | Game | Real figure + source | Yes/no |
|---|---|---|---|
| Band multiply | 0.85–1.15 (amp 0.15). A pure sine of amplitude 0.15 has CV 0.15/sqrt(2) ≈ 10.6%. The shader clamps, so pixels stay inside the bound and many do not reach it. | Juola, Hovi & Rautiainen 2022, Ecol. Evol. 12:e8718, doi:10.1002/ece3.8718. Between-tree VIS–NIR CV is 8–32% for the non-birch species and 34–46% for silver birch (white bark, black spots). Measured on mean spectra of 11.1 cm images, not along one trunk. | No. Same order as the non-birch between-tree CV only. It is not a within-trunk measurement, and it is below birch's black-on-white spots (those stay in the species bark shaders). |
| Full-cycle spacing | Vertical 0.357 m, along +X 0.500 m, along +Z 0.556 m. Half-cycle stripe width is half of that. Phase warp up to about one cycle (`2.2 * vnoiseU` on a sine of period 2). | Same paper: the bark image is 11.1 × 11.1 cm, the scale of plates and lenticels they photographed. Bondy gneiss, Blein, NRCAN ae83ea04-31c8-4cb2-984a-d9f42c2aeb53: mafic/felsic layers millimetres to centimetres; felsic veins centimetres to decimetres. | No for bark plates (about 3× coarser than the 11.1 cm window). Decimetre veins are a real rock scale, but rocks set `userData.noBands`, so the sine is what bark and props draw. |
| Logs and rocks | No shared-band multiply. `userData.noBands` on `LOG_MATERIAL` and `ROCK_MATERIAL`. | T-0005 log bark and T-0026 rock bands are their own patterns, which is what the coordination section requires so two layers do not stack. | Yes for the coordination rule. The shared chunk is not the log's or the rock's colour variation. |

The numbers gate does not pass. No complete event.

## Frame gate
Not run yet on this VM. Omen (bench lock, vsync off, Ultra and Medium within 5%, captures under `/workspace/bands/` on that box) is outside this VM. A headless capture will be attempted and labelled. Scores from SwiftShader are not the omen gate.

## Checks on this VM
- `npx tsc --noEmit`: exit 0, before the PR and again with the contrast change.
- `npx tsx --test tests/*.test.ts` (the `npm test` script): 641 tests, 627 pass, 0 fail, 14 todo. The 14 todos are the existing board todos, not new failures.
- PR: https://github.com/BannonBotBoss/boreal/pull/65 . CI status is recorded in the PR body after the run finishes.

## Frame gate (this VM, not omen)
Stills: `tasks/evidence/T-0004/log-on.png`, `log-off.png`, `trunk-on.png`, `trunk-off.png`. Script: `tasks/evidence/T-0004/capture.mjs` (headless Chrome, SwiftShader, `?nomenu&hour=15`). Wind amplitude forced to 0 after load. Measure: `tasks/evidence/T-0004/measure.mjs`, numbers in `measure.json`.

What the frames show: a wolf seen from behind in a flat overcast boreal stand, HUD in the corner. The log pair has a fallen trunk across the lower middle. The trunk pair has a standing trunk just ahead of the wolf. I do not see a new set of darker and lighter bands appearing when the query is left on.

Metric: mean absolute luminance in a center box (30–70% of width, 35–72% of height), chosen before the score. Tool calibration: the same frame against itself scores 0. A synthetic sine of amplitude 0.15 across the log-off box moves the coefficient of variation from 0.907 to 0.927 (delta 0.020). That is the known mismatch for the plan's contrast. It is not a nature photo.

| Pair | Mean abs luminance | CV on | CV off | Notes |
|---|---|---|---|---|
| Log | 4.68 | 0.933 | 0.907 | Not a matched pair. `log-on` was the cold load (200 s, 178 links) while the startup probe ran. `LOG_MATERIAL` sets `noBands`, so the shared chunk is not on the log. |
| Trunk | 0.51 | 0.55732 | 0.55740 | Matched pair (both ~44 s, probe cache warm). CV delta 0.00008, about 250× smaller than the calibrated 0.15 sine. |

The trunk pair does not show the 0.85–1.15 multiply in that box. 95% resemblance to a nature reference: no reference was generated, so that comparison is unmeasurable. The pixel comparison against the plan's own contrast fails.

Program links, trunk pair only (same place, Minimum, SwiftShader): 74 with bands, 74 with `?bands=0`. Shader sources containing `float bt =`: 4 when on, 0 when off. The link count did not rise. The cold `log-on` count of 178 is the probe compiling before the SwiftShader cap was cached, not the bands cost.

Frame time substitute, same trunk pair, median of 30 `requestAnimationFrame` intervals: 299.6 ms with bands, 309.1 ms with `?bands=0`. Bands-on is 3.1% lower. This is not the omen gate. Renderer string: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`. Governor tier: Minimum, auto. No GPU timer. Sample is 30 frames at about 3 fps. Uncalibrated for "Ultra and Medium within 5%".

## Next
Leave the task open. No complete event. A non-author reviews the PR. The omen bench and a generated reference are still listed below.

## Needs from another agent
- Omen, bench lock, vsync off. From a worktree of this branch, two runs of the in-game `?bench=1` (see `src/main.ts`), one with bands on and one with `&bands=0`, same seed and start. Record Ultra and Medium `frame` and `gpu` ms. Pass only if each is within 5% of the other. Also record program-link count and how many shader sources contain `float bt =`. Do not treat a software renderer as a pass. Save the console log next to the captures. This VM's SwiftShader numbers above are a substitute, not that gate.
- Captures Matthew asked for, on the omen box, under `/workspace/bands/`. Before = `?bands=0`, after = bands on (no `bands` query, amp 0.15). Same `?nomenu&hour=15&at=`. One frame on a fallen log, one on a trunk, at Ultra, not Minimum. The SwiftShader stills in `tasks/evidence/T-0004/` are the attempt from this VM. The log material opts out, so a log frame will not show this chunk; a prop or the trunk is the surface that has it.
- Generated reference frames (rule 6): a 3–5 s clip or stills of a boreal fallen log and a spruce/pine trunk in diffuse daylight, camera about 1.5 m away and about 0.8 m off the ground, showing darker and lighter bands across bark. Save under `tasks/evidence/T-0004/reference/`. Grok generates these. A generated picture is a look reference, not a position certificate (rule 11).
- A non-author review of the PR. grokbot-3 must not review `grokbot-3/surface-bands`.
