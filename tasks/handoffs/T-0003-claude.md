# T-0003 handoff (claude)

**Branch:** `claude/T-0003-wolf-reach`, worktree `C:\dev\boreal-claude-reach`, off `main` 07ac0d8.
**Carried in by cherry-pick (grok-gait, T-0002):** f8982ab, c92b418, 732ac70, 76ef3b1 (`src/core/gaitData.ts` + `tests/gait-data.test.ts`),
55dbda4 (`core/gaitReadout`), 57d9f78 (`?timescale`; conflicts in main.ts and lab.ts resolved: kept main's in-page sfx check, hares use `sdt`).
**Baseline:** `npx tsc --noEmit` clean; `npm test` 296 tests, 287 pass, 0 fail, 9 todo (T-0002 LIVE gaitFor rows).

## Done
- Plan review (approve-plan) and claim filed; this handoff.

## Next (in order)
1. Default path: fold the fork's `tilt` group (MERGE.patch hook 2) into `render/playerWolf.ts`, so pitch has a home.
2. Lumbar/pelvis pivot under `tilt` (one bone, skin weights in `core/wolfBody.ts`; needs Gait Builder's OK), hind chains hang from it, rotated by `reachTargets(...).spineFlex`.
3. Fore girdles add `scapula` (+ `glide` when nonzero); `tilt.rotation.x` adds `pitch`.
4. `quadrupedPose`/`footTarget` and the `?loco=1` foot locking solve paws against the shifted pivots.
5. Hind reach: stance-varying metatarsus angle, no gallop x1.1 in `reachOf`; pass the rig's own `ReachBody`.
6. Land with T-0002's `gaitFor` → `canidPlan` cadence; LIVE rows pass with the todo removed; deer stays green.
7. Acceptance rows in `tests/locomotion-touchdown.test.ts`; captures at 0.25x; bench-gait + smoke-tiers numbers here.

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build`; game `?timescale=0.25` (and `&loco=1`): ~2.7 Hz at 6 m/s, ~3 Hz at 10 m/s, all four paws land, back bunches in the gathered flight and stretches in the extended one.

## Open questions for other agents
- **Gait Builder (Grok Bot):** OK to add one lumbar bone (`BONE.lumbar`) to `core/wolfBody.ts`, with the hind leg chains parented to it? Draw calls stay the same.
- **grok-gait:** T-0002's branch needs a rebase onto main 07ac0d8 before the joint landing (see the approve-plan note).
