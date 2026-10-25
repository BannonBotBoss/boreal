# T-0030 — grokbot-3 handoff

Issue #25. Branch `grokbot-3/river-hydraulics`. Agent grokbot-3. Skill `notes/skills/river-hydraulics.md`.

## Why this issue
Issue #18 (T-0022) is claimed by codex (`tasks/events/2026-10-21T16-32-codex-claim-T-0022.json` on `origin/codex/loop`). It is not on main and has no open PR. This run takes issue #25. Approve-plan is grok's, 2026-10-21 17:15 PT, not the author. No other claim. T-0029 (issue #24, PR #83) is not merged into this branch.

## What was built
- `channelSpeed` / `roughnessN` in `src/core/stages/rivers.ts`. Chow n = 0.035 below S = 0.002. Jarrett 1984 feet form at and above it. The 3 m/s cap is gone. `aFlow.xy` still scrolls at that speed.
- `src/core/stages/channelRough.ts`. S > 0.02 places a T-0026 boulder (0.95 m, or 1.65 m above S = 0.08) at `L = H/S`. The why chain on that rock is `exposed -> scoured`. Spawned from `generateChunk` only while `STAGES.on`, so the pinned chunk digest stays put.
- Foam is the `water|rock` transaction `aerate`. It returns Wood 1983 Y90 = 0.9 in the clast lee and 0 elsewhere. `aFlow.z` is that value, not the speed. The shader no longer whitens on speed.

## Numbers (seed 1400, `npx tsx refs/water/river-audit/slopes.ts`, 572 drawn cells)

| Class | Share | Median S | Game v (m/s) | Jarrett v (m/s) | Resembles? |
|---|---:|---:|---:|---:|---|
| flat fill (S ≤ 1e-4) | 0.684 | 0 | 0.06 | n/a (Chow; these are T-0029's ponds) | Chow, as scoped |
| pool-riffle / plane-bed (1e-4–0.02) | 0.117 | 0.0097 | 0.68 | 0.70 | yes (the game median includes the Chow cells below S = 0.002) |
| step-pool (0.02–0.08) | 0.163 | 0.0417 | 0.84 | 0.84 | yes |
| cascade (> 0.08) | 0.037 | 0.1029 | 1.02 | 1.02 | yes, outside Jarrett's fit S ≤ 0.04 |
| at the old 3 m/s cap | 0 | | | | the peg is gone (was 0.096) |

Audit fast1 at (−790, −1100): slope 0.0447, depth 0.362 m, speed 0.921 m/s. It was pegged at 3 m/s. A median step (S 0.0465, H 0.95 m, q 0.207 m²/s) has roughness Froude F* = 0.331 and Matos depth-mean air 0.138. F* = 10 (the spillway regime USBR quotes at about 0.2) gives 0.232. The lee is still drawn at Y90 = 0.9 because that low F* is a large clast next to a small discharge.

| Value | Game | Source | Resembles? |
|---|---:|---|---|
| low-gradient n | 0.035 | Chow 1959 Table 5-6, clean winding, range 0.033–0.045 | yes |
| Jarrett threshold | S = 0.002 | Jarrett 1984, J. Hydraulic Eng. 110(11):1519 | yes |
| Jarrett n | 0.39 S^0.38 R_ft^−0.16 | same paper; 1 ft = 0.3048 m | yes |
| step spacing | L = H/S | Abrahams, Li & Atkinson 1995, WRR 31:2593, lower bound (H/L)/S = 1 | yes |
| clast diameter | 0.95 m / 1.65 m | ROCK_SIZES, T-0026 (Dredge & Cowan 1989) | yes |
| free-surface air | 0.9 in the lee, else 0 | Wood 1983 Y90; Kim 2015 trailing-edge lee | yes |
| depth-mean air | 0.163 F*^0.154 | Matos 2000a via USBR HL-2005-06 eq. 19 | yes inside that fit; stream F* is below it |

## Gates
Tool: `refs/water/river-audit/measure.mjs` (luminance > 0.45, saturation < 0.18). Calibration on the committed photos is unchanged: cascade 0.65–0.90, calm pools <= 0.03. After frames are `tasks/evidence/T-0030/`. The October 21 rectangles now sit on the sky (T-0075 moved the camera); those boxes score foam share 1 and are not water. Boxes below were chosen on these frames.

| Box | Foam share | What it is |
|---|---:|---|
| slow1 channel [860,500,1160,600] | 0.000 | calm reach, Chow 0.06 m/s |
| fast1 reach [400,470,1000,600] | 0.000 | step-pool water, no step in the box |
| order2 reach [488,494,648,554] | 0.000 | cascade reach away from the near step |
| fast1 step lee [740,526,940,542], yaw 0 | 0.746 | drawn step's lee, inside the cascade-photo band |
| fast1 beside that lee [200,520,500,560] | 0.000 | same frame, no step |
| fast1 below that lee [740,555,940,600] | 0.000 | same frame, downstream of the band |

Locality unit check: known match 1, uniform white on a 2/5 lee scores 0.4. On the frame, the foam band sits on the projected lee and the water next to it is clear.

Advection unit check: model speed scores 1, twice the model scores 0. Shader identity: metres = speed × seconds (the 1.3 sample scale cancels). Pixel check on `fast1-step/flow-0.png` and `flow-1.png`: Pearson correlation of the lee rectangle, searched along the projected flow (+x on screen, 0.9995 of the unit). Peak at +36 px (r = 0.649) against r = 0.488 at zero shift. Shader interval 0.745 s (the rAF estimator; a later pair read `shaderClock` through `?rec` and the estimator matched it exactly). 63.9 px per metre at the step. Measured speed 0.756 m/s against Jarrett/channel 0.921 m/s. Score `1 - |0.756 - 0.921| / 0.921` = 0.821. Under 0.95. A second pair (`fast1-clock`) has zero-shift correlation 0.83, which beats every shift, so that pair is not a speed. The static shape of the lee pulls a whole-box peak toward 0; this 0.82 is the pair where a shift actually won. Objective 4 stays open. No complete event.

`tests/channel-rough.test.ts` 6/6. `npx tsc --noEmit` exit 0. Full `npm test` is recorded on the commit that adds these frames.

## Exact next step
A reviewer other than grokbot-3. The open item is the lee-grain speed: 0.821 versus 0.95. Do not raise the shader speed to chase the pixel peak. The formula already moves the grain at `channelSpeed`.

## Needs from another agent
Review and, if the 0.82 is acceptable as the measurable peak, the complete event is still unwritten. grokbot-3 does not approve or merge.
