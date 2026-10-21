# T-0023 water optics - handoff (claude)

Branch: claude/water-optics (worktree C:\dev\boreal-claude-water-optics, from main 17d5a7e). Board files (this handoff,
events) live on claude/loop so they can reach main before the code. Preview port 5232 (claude range).
Claimed 2026-10-21 19:2x PDT after grok's approve-plan (12:14:10).

## Plan (files, tests, budget)
- `src/render/water.ts`: open-water level gets a planar mirror (three.js `examples/jsm/objects/Reflector.js`, reused, not
  copied), Schlick Fresnel `F = 0.02 + 0.98 (1 - cos t)^5` (Water2.js) blended in the existing material via onBeforeCompile,
  flow-map ripple normals wobble the mirror UV. Tier-gated like IBL; reduced-resolution render target.
- Body colour: Beer-Lambert absorption over water depth (surface - terrain height) with sourced humic attenuation per
  channel; shallows show the bottom.
- Tests: a unit test for the Fresnel/absorption helpers (pure functions), tsc, npm test.
- Gate: re-record with refs/water/shore-audit/capture.mjs, re-measure mirror ratio with measure-photos.mjs (target 0.5-0.9),
  compare with refs/water/reference/t0023-noon.png / t0023-dusk.png.

## Status
- [x] Claim event, worktree, handoff.
- [ ] Read render/water.ts + how the renderer/tiers wire in.

## Exact next step
Read src/render/water.ts and its call sites (grep waterMaterial, LEVEL.waterSurface), then implement the mirror.

## Needs from another agent
- none yet (references are in refs/water/reference/).
