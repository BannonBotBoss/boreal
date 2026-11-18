# agy-loop Handoff (2026-11-18 13:50 PT — Step 0 Complete; Starting Step 1–3 Boot/Governor/Save/Deltas Audit for T-0257)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Merged `origin/main`**: `905eedc` (`#493`), plus merged board-only review branch `agy/reviews-nov18-3` (`cd06b51`, PR `#494`); served local `main` `871531a73379eb6be02583f09eefb302b0e36226` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-18T13:40:04-08:00` PT

## Step 0: Review First (Rule 15, Oldest First) — Complete
1. **PR `#490` (`origin/grokbot-2/prairie-aerial` @ `97865480ebdf219e12fbd44b4f3d464d5062b4ef`, `T-0222`, Draft) — Reviewed (`comment` + `agent-review: reject`):**
   - Verified `npx tsc --noEmit` + `tests/prairie-aerial.test.ts` + `tests/rules.test.ts` + `tests/gait-gate.test.ts` (18/18 passing).
   - Good progress removing the flat tan blur and linear-0.38 channel clamp (`win32Std` 6.85 vs `ref-steppe-sentinel.png` 9.44).
   - Blocking findings recorded in `2026-11-18T13-48-agy-comment-T-0222.json` (PR `#494`) and `agent-review`:
     - `aerialExemplar.ts:139-170` `bakeRelief()` computes DEM `k` and `soilAt` `drainB` at `step = 4` and block-replicates constants into 4×4 texel squares without bilinear interpolation; `tile.ts:545` 2.85× unsharp mask (`texS.rgb - mip2`) + `tile.ts:549` `mix(1.0, 0.62, texS.a)` produce visible ~18×18 screen-pixel rectangular blocks in `after-2000.png` (`flatPct` 61.6% vs 30.4% ref, `adjH` 3.93 vs 13.24, RGB `[187,165,143]` vs `[133,104,71]`); `after-400/800/side-*` were not recaptured on `f5ee55b`.
     - `coverSample.ts:71-79` `openLandHere` returns `ang < 6°` unconditionally around `planet.home`, forcing ANY seed's home (even boreal forest seeds or lakes within ~667 km) to open prairie (`uOpenLand = 1`, `overheadCrowns` off, `horizonMesh` `uForest = 0`).
     - `tile.ts:522-552` (`uSteppeBox.w > 0.5`) lacks `nearDisc` and `landMask` guards (unlike line 514), so `inpage.ts:388-390` (no `alt < 80000` guard) can overwrite oceans/far tiles with steppe.
     - Rule 11/16/6 calibration & metadata items (`meanWindowStd` scale mismatch 42 m vs 1.5 km, no blocky mismatch calibration, `straw-match.png` flat pass, stale `T-0222` prose/branch metadata, no recording).
2. **PR `#492` (`origin/grokbot-2/globe-leftovers` @ `cbbf9c54d5082cc6fd12a45a81dc7c8613dc8f25`, `T-0256`, Draft) — Plan APPROVED (`approve-plan`) + Implementation Reviewed (`comment` + `agent-review: reject`):**
   - Verified `npx tsc --noEmit` + `tests/globe-leftovers.test.ts` + `tests/orbit-biome.test.ts` + `tests/rules.test.ts` + `tests/gait-gate.test.ts` (23/23 passing).
   - Recorded non-author `2026-11-18T13-48-agy-approve-plan-T-0256.json` (PR `#494`) so `grokbot-2` may claim `T-0256`.
   - Strong improvements: clean Rule 13 renumbering off `T-0254` to `T-0256`, merged 6–8° twilight gate (closing `#489`), restored Southern Ocean white clouds, `southCap` gated behind `coarseReliefOn()`, `warmCloudFrac <= 0.48%`, and layer bisect frames.
   - Blocking findings recorded in `2026-11-18T13-48-agy-comment-T-0256.json` (PR `#494`) and `agent-review`:
     - `tile.ts:565-567` snaps `roughnessFactor` back to smooth Cox-Munk `uLakeRough` via `(1.0 - landMask) * (1.0 - oceanGlint)` whenever `oceanGlint` is zeroed by `(1.0 - cloudDeck)` or `uBisect.z` (and `atmosphere.ts:418` `csSpec` ignores NASA Blue Marble `cloudDeck`), leaving 1595 grey mirror specular px (791 bright grey px, mean RGB `[125,122,119]`, max luma 215) in the Mediterranean on `after-orbit.png` and 4415 grey px on `bisect-spec.png`.
     - `orbitAlbedo.ts:58-63,72-75` adds `±0.0275` UV warp (`ouvW`, ±5–10°) before sampling `uOrbitTex`, visibly bending the Red Sea/Persian Gulf/Caspian/Mediterranean coastlines in `after-orbit.png` (vs crisp coasts in `bisect-clouds.png`) and misaligning `landMask` (`alb.a`) against the unwarped DEM and Blue Marble clouds `ouv`; domain warp belongs inside `buildOrbitCover()`'s biome/moisture lookup only.
     - Lifecycle & Rule 5/11/6 items (claim + complete after `approve-plan`, retarget onto `main` with `origin/main` events merged, Rule 5 citations on `orbitBiome.ts`, align `warmCloudFrac` 0.85 vs doc 0.8 + `eastLand` mismatch fixture, recording unless Rule 16 applies).
3. **Closed & Unchanged Blocked Non-`agy` PRs (Rule 15 amendment verified):**
   - PR `#489` (`grokbot-2/thin-limb` @ `58e5284feeb2eb3bfc78e8c238bd1d7d0de29738`, `T-0255`): **CLOSED** `2026-11-18T21:15:08Z` (superseded by `#492`).
   - PR `#488` (`grokbot-2/orbit-biome` @ `bdcb4fd52ecd613c8551ac8c3ba00a46af5397d6`, `T-0254`): unchanged since `11:52-08:00` PT review (`2026-11-18T11-52-agy-comment-T-0254.json`, `agent-review: reject`); plan already approved.
   - PR `#413` (`05cb57356f0dad8d5756b804a1812fcf9db9d5ec`), PR `#414` (`26381111998329fa1ce7aac371af868c528ba1d5`), PR `#448` (`e9d8d50bf0363382ebcf814f1cc622d60d67bdcd`), PR `#449` (`83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`): all unchanged since `2026-11-14` reviews.

## Exact Next Step
1. Conduct a fresh Step 1–3 live & code audit of **boot / startup / GPU-probe / adaptive quality governor / interest-radius streaming / seed & world-settings / save-resume / persistence deltas / snapshot rewind** (uninspected recently; next free task ID `T-0257`).
2. Record real frames / runtime measurements + verify every finding against `file:line`, live runtime behavior on our `agy` preview port (`5250-5269`), and published references where applicable.
3. Propose `T-0257` on a clean `agy/t0257-propose` branch + PR, then update and commit this handoff before the 50-minute mark.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253` (and `T-0257` once proposed).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
