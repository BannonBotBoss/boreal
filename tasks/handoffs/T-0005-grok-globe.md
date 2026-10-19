# Handoff: T-0005 fallen logs, grounding and bark (grok-globe, 2026-10-19 06:49 PT)
Requested by Matthew (2026-10-19 06:37 PT, screenshot of a level log floating off a slope). Plan approved by grok (664d2a8).
Branch `grok-globe/log-grounding-bark`, worktree `C:\dev\boreal-grok-globe`, off main 7d71892. Matthew merges.
Matthew's clarification (06:48 PT): logs must sink partway into the ground (partial bury, 20-35 % of the thickness, seeded).
He also mentioned contact triggering a "transaction" and has not said what that means yet, so **no contact-triggered
behaviour (animation, game system) is built here**; it waits for Matthew to spell it out.

## Merge order (please keep)
1. `perf6/near-shadows` (4c8d933): `LOG_MATERIAL` and near-cascade-only shadows for logs and rocks.
2. `grok/surface-bands`: global band multiply; the log material opts out with `userData.noBands = true`.
3. This branch. It merges 4c8d933 in (a merge commit, no edits to it), so after step 1 it adds only its own commits, and
   `render/photoreal.ts` is not touched. It does not contain surface-bands; it only sets the opt-out flag that branch reads.

## Pieces (one commit each)
- [x] propose + claim events, this handoff, notes/grok-globe.md (before any code)
- [ ] merge perf6/near-shadows 4c8d933 (no conflicts expected: it touches geometry.ts and photoreal.ts only)
- [ ] `tests/log-seat.test.ts` (fails on main: the log is not seated)
- [ ] `seatLog` (pitch, roll, seeded 20-35 % sink from heightAt at both ends, the middle and across)
- [ ] bark material hook on `LOG_MATERIAL` + `bark` vertex attribute, 12 sides at LOD 0, smooth normals
- [ ] `noBands`, tier strength uniform (off on Low, Very low, Minimum), fade kept
- [ ] budget numbers, smoke-tiers, captures

## How the bark data survives the batch (plan review nit 2)
Log parts are `userData.shared` meshes on `LOG_MATERIAL`, so `render/batch.ts` `flatten` uses `placed()`, which clones every
attribute other than position/normal/tangent unchanged. The body and the end disc of every LOD both carry `color` and `bark`,
so `mergeGeometries` and the BatchedMesh see one attribute set.

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build` in the worktree; `node tools/smoke-tiers.mjs http://127.0.0.1:<port>` against
the worktree's own dev server on a separate port.

## Log
- 06:49 claimed; handoff and notes first.