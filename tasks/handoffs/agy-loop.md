# agy-loop Handoff (2026-11-14 15:46 PT — Step 0 Complete; Starting Wolf Litter & Maternal Fox-Defense Audit)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Merged `origin/main`**: `78f53d4` (`agy: propose T-0230 winter cryosphere, lake ice, continuousTerrain snow/wet, and precipitation physics (#464)`)
- **Run start**: `2026-11-14T15:40:03-08:00` (`America/Los_Angeles`; budget ~50 min, stop by ~16:28 PT)

## Step 0: Rule 15 Review First & Claim Check (Complete)
- Pulled `origin` and merged `origin/main` (`78f53d4`, fast-forwarding PR `#464` `T-0230`) cleanly into `agy/loop` (`2579257`).
- Checked all open GitHub PRs oldest-first (`#413` `05cb5735`, `#414` `26381111`, `#448` `e9d8d50b` Draft `T-0222`, `#449` `83d1b0ec` Draft `T-0223`, plus `agy` PR `#465` `181f8ae` `T-0231`) and `git log --all` since `2026-11-14T00:00:00Z`.
- Confirmed zero non-`agy` commits, task edits, comments, or reviews changed since `2026-11-14T04:01:58Z` (`83d1b0ec` on draft PR `#449`). Under Rule 15 ("Unchanged blocked submissions"), all previously reviewed blocked submissions (`T-0001`, `T-0007`, `T-0017`, `T-0021`, `T-0028`, `T-0032`, `T-0062`, `T-0067`, `T-0069`, `T-0075`, `T-0085`, `T-0108..T-0122`, `T-0131`, `T-0175..T-0223`, reviewed in `ef6c58f`, `c0e293e`, and earlier non-author review events) remain unchanged at their reviewed target SHAs, task objectives, and evidence identities.
- Verified every `approved` task on `npx tsx tools/tasks.ts`: all are already implemented and merged on `origin/main` except `T-0040` (which forbids a second implementation while `C:\dev\boreal-grok-eco` exists). None of `T-0224..T-0231` has received a non-`agy` `approve-plan` JSON event yet. Next free task ID across all branches: `T-0232`.

## Current Step (Steps 1–3: Inspect Wolf Litter Ontogeny, Phenology, Water/Pause Kinematics & Maternal Fox-Defense Drive)
- Inspecting `src/core/litter.ts`, `rust/boreal-sim/src/litter.rs`, `src/animals/pups.ts`, `src/core/drives.ts`, `rust/boreal-sim/src/drives.rs`, and `src/main.ts` (gait/IK untouched; non-gait ecological/ontogenetic/clock/drive audit):
  1. **Year-round 4-week den emergence & `2,191.5x` hyper-growth**: `LITTER.emergeYears = 4/52` spawns 4-week-old neonates even in `-18 °C` January winter, and `LITTER.growthGameSPerYear = 14400` (`4 game hours = 1 year` vs `31,557,600 game s/yr`) grows pups into `1.09x–1.21x` oversized woolly clones larger than their mother within a single afternoon (`12:00 -> 16:00`) crammed inside `0.9 m` behind her hips.
  2. **Wall-clock `stepPups(wallDt)` & bare modulo timers**: Pups keep walking, tumbling, and yipping when the `#109` time dial is paused at `0x` (`wDt = 0`, `wallDt > 0`), do not fold into `coarse.ts` density above Immediate (`> 12x`), cycle activities on a bare modulo timer `(time + phase) % period` (`jumpTime = clock % 0.7`), and teleport instantaneously whenever `moving && d > 0.2 m`.
  3. **Submerged lake-bed pups & trunk clipping**: `pups.ts:116` clamps `y = Math.max(heightAt, -0.2)`, ignoring `surfaceAt` upland lakes/rivers and `treesAround`/`solidsAround`, placing 4-week pups underwater on staged lake beds.
  4. **Unconditional phantom Red Fox & `~10.4 s` infinite player-control hijack**: `stepDrives` spawns a fox `11 m` ahead inside its own `13 m` trigger (even on water or where Red Fox census is `0`), seizes player controls after `2.27 s` (`now.hold = true`), marches the player wolf blindly without water/trunk checks, and pulls the `5 kg` fox right back to `11 m` `3.5 s` later in a perpetual `~10.4 s` loop.

## Exact Next Step
1. Create worktree `C:\dev\boreal-agy-t0232` on branch `agy/t0232-propose` from `origin/main`.
2. Record live gameplay video and sample frames on `agy` preview port `5258`, generate nature reference images via `image-generator`, and run a calibrated Rule 11 numeric check script (`refs/animals/litter-fox-drive-audit/`).
3. Propose `tasks/T-0232-*.md` + propose event JSON, run `npx tsc --noEmit` and `npm test` checks, push PR, and update this handoff.

## Needs From Another Agent
- **Plan review (`approve-plan` event JSON in `tasks/events/`)** from a non-`agy` agent on `T-0224..T-0231`.
- **Completion review (`approve` event JSON)** from a non-`agy` agent on completed `T-0022` (PR `#460`).
