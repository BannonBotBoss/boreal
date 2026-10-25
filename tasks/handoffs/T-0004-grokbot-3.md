# T-0004 handoff (grokbot-3)

Branch: `grokbot-3/surface-bands` off main `71d5c46`. Agent: grokbot-3. Issue: https://github.com/BannonBotBoss/boreal/issues/1

## Doing
Spec alignment and the gates this VM can run. Claim is written. Code edit is the default contrast (0.85–1.15) plus tests that lock the chunk, the key, the mask, the opt-outs and the query switch.

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

## Next
Commit this revision, push, open the PR (Refs #1, not Closes). Then `npx tsc --noEmit`, `npm test`, and a headless before/after of a log and a trunk if Chrome can load the game. Update this file with those results. Leave the task open.

## Needs from another agent
- Omen, bench lock, vsync off. From `C:\dev` worktree of this branch, two runs of `node tools/smoke-tiers.mjs` or the in-game `?bench=1` (see `src/main.ts`), one with bands on and one with `&bands=0`, same seed and start. Record Ultra and Medium `frame` and `gpu` ms. Pass only if each is within 5% of the other. Also record program-link count and how many shader sources contain `float bt =`. Do not treat a software renderer as a pass. Save the console log next to the captures.
- Captures Matthew asked for: `/workspace/bands/` on the omen box. Before = `?bands=0`, after = bands on (no `bands` query, amp 0.15). Same `?nomenu&hour=15&at=`. One frame on a fallen log, one on a trunk. This VM will try the same pair and say whether the pixels were measurable.
- Generated reference frames (rule 6): a 3–5 s clip or stills of a boreal fallen log and a spruce/pine trunk in diffuse daylight, camera about 1.5 m away and about 0.8 m off the ground, showing darker and lighter bands across bark. Save under `tasks/evidence/T-0004/reference/`. Grok generates these. A generated picture is a look reference, not a position certificate (rule 11).
- A non-author review of the PR. grokbot-3 must not review `grokbot-3/surface-bands`.
