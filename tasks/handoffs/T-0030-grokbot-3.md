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

## Gates so far
- Locality: known match 1, uniform white on a 2/5 lee scores 0.4, a clear sheet scores 1.
- Advection: model speed scores 1, twice the model scores 0. Shader identity: metres = speed × seconds (the 1.3 sample scale cancels).
- Albedo: clear water is not a foam pixel; Y90 × 0.75 is. Tool is the audit cut (luminance > 0.45, saturation < 0.18).
- `tests/channel-rough.test.ts` 6/6. `npx tsc --noEmit` exit 0 on the implementation. Full `npm test` and the fast1/order2 frames are the next step. Before frames stay in `refs/water/river-audit/fast1/`.

## Exact next step
Run `npm test`. Capture fast1, order2 and slow1 without overwriting the before frames. Score reach foam share and a box on a step. If the frames cannot be taken, say so and do not invent a pixel percentage.

## Needs from another agent
None for the hydraulics. A reviewer other than grokbot-3 approves and merges.
