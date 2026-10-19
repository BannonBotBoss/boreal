---
id: T-0005
title: Fallen logs - settled into the slope (pitch, roll, partial burial) and a procedural bark shader
author: grok-globe
scratch: false
research: true
skill: false
---
# T-0005 Fallen logs: grounding and bark

**Status: proposed, not yet approved.** Matthew asked for it directly (2026-10-19, about 06:35 PT, with an in-game screenshot
of a level brown log floating off a slope): "fix this, so the logs are settled down into the ground, and the surface has
random noise generated shader that gives it the appearance of bark". He asked for this plan before any code.
Branch: `grok-globe/log-grounding-bark` (from main 7d71892). Number: T-0004 is already named in `grok/surface-bands`'
commits, so this takes T-0005.

## How logs work now (main 7d71892, read-only check)
- **Generated:** `core/world.ts:48` `KIND_TABLE` (11 % of chunk candidates are `log`), scaled by `core/population.ts:30`;
  `core/catalog.ts:25` "Horizontal trunk with pale cut ends". Each entity has x, z, `rotation` (yaw), `scale`, `seed`.
- **Shaped:** `render/geometry.ts:23-25`: one `CylinderGeometry(.32, .43, 4.4, segments)` with `segments = [9, 6, 4]` per
  LOD (`:14`), turned to lie along x, its axis 0.40 m above the entity origin, plus one pale end disc at +x only. The parts use
  per-part `MeshStandardMaterial` (wood 0x70513b, roughness .95, `flatShading`). At LOD 2 (from 115 m x `RENDER.lod.props`)
  the log is a 4-sided prism, which is the "box" in the screenshot. LOD ranges: `render/buildScene.ts:110` `[0, 55, 115]`.
- **Placed:** `render/buildScene.ts:111-114`: `y = heightAt(entity.x, entity.z)` at the centre only, then batched at that
  point; the group gets only yaw and scale (`geometry.ts:48`). Nothing samples the ground at the ends, so on a slope one end
  floats and the other is buried. At the centre the bottom sits about 0.03 m below ground (0.40 - 0.43).
- **Shaded:** `render/batch.ts:57-70` flattens the parts into vertex colours on the shared `PROP_MATERIAL` (`batch.ts:14`:
  flat colour, `flatShading`, no noise; one BatchedMesh per chunk shared with plants and bushes; `castShadow` false, `:95`).
  `fadeOptIn(mat, true)` wires the in-page patch fade (`batch.ts:90`). Rocks already have a procedural material
  (`ROCK_MATERIAL`, `batch.ts:17-24`, `proc/glsl` noise) and a ground-seating routine (`render/rocks.ts:42` `seatRock`).
- **Pending, not on main:** `perf6/near-shadows` 4c8d933 gives logs their own `LOG_MATERIAL` (`render/geometry.ts`, same
  parameters and program key as `PROP_MATERIAL`, vertex colour), so logs cast shadows into the near cascade only
  (`render/photoreal.ts`). `grok/surface-bands` (b73a7e4, in progress) adds a noise colour-band multiply to solid materials
  without a `.map`; a material opts out with `material.userData.noBands`.
- **Other users of the log size:** `render/flora/flora.ts:61` (ground-plant footprint 2.25 x 0.45 m along x, not rotated
  with the log's yaw) and `render/mass.ts:18` (frustum .43/.32, 4.4 m).
- **Owners:** the log recipe dates from the baseline (56506c5) and has no agent owner; `render/batch.ts` and `render/rocks.ts`
  are Grok Bot's. Grok Bot confirmed nobody owns log grounding or bark. The plan touches none of Claude's animal files, the
  river files, or the grass/flora shaders.
- **Programs:** logs share the props program today (no log-specific program). The game shows 74 programs on the ground and
  75 in the in-page band (captures of 2026-10-18).

## Research (sources)
- **Settling objects on terrain:** engines project the object to the ground, align it to the surface normal, keep a random yaw
  and add a small negative offset to bury it: Unreal PCG (Epic, "A Tech Artist's Guide to PCG",
  dev.epicgames.com/community/learning/knowledge-base/KP2D; partial burial with a Transform Points offset, e.g. Hyperdense,
  "PCG Basics", Medium 2026); ezEngine ProcGen placement `AlignToNormal` and "Raycast High Quality", which averages extra
  ground samples around the object for a smoother orientation (ezengine.net, procgen-graph-output-placement). For a long
  object the equivalent is sampling the ground at both ends and along the axis: pitch from the end heights, roll from the
  cross-slope, then sink by a fraction of the radius.
- **Procedural bark:** anisotropic noise stretched along the trunk axis and given high contrast for fissures (Blender Stack
  Exchange, "procedural white birch bark", noise scaled about 4:4:40 along the axis); `|noise(x, y) + sin(16 pi y)|` strips
  (e-notes, "Procedural bark textures", ibiblio.org/e-notes/Splines/tree/bark.htm); domain-warped fBm for plates and
  V-grooves (symbios-texture `bark.rs`, docs.rs); anisotropic line-segment noise for oriented cracks (M. Anders, "Noise
  experiment with Open Shading Language", 2016); anti-aliased thresholds with `fwidth` so thin fissures don't shimmer
  (thorium.rocks "Fissures" WebGL demo). The project already ships the noise: `proc/glsl.ts` `vnoise`, `hash2u`, `vnoiseU`
  (seamless) and `fbm`.

## Approach
1. **Grounding (CPU, at chunk build, deterministic):** sample `heightAt` (the same seeded function the terrain uses) at the two
   ends and the middle of the log's axis in world space, after yaw and scale. Pitch = atan of the end-height difference over
   the length; roll from the cross-slope at the middle (two samples +-r across the axis); centre height = the mean of the
   axis samples, sunk by 20-35 % of the radius, seeded per log from `entity.seed`. The rotation is baked into the flattened
   geometry as the yaw already is, so the batch instance stays a translation. Same pattern as `seatRock`.
2. **Bark (GPU, one shared material):** logs keep one material (`LOG_MATERIAL` from 4c8d933 if merged, otherwise created the
   same way) with an `onBeforeCompile` hook. Coordinates along the log axis and round it come from a per-vertex attribute so
   the batch can carry them, plus a per-log seed. Albedo: stretched `vnoiseU` fissures (dark, about x0.45) and ridges (light,
   about x1.15), a low-frequency brightness and hue drift per log; the pale cut end stays plain. Normal: perturbed from the
   screen-space derivatives (`dFdx`/`dFdy`) of the same height field, so ridges catch the light. No textures, no per-log
   material, `userData.noBands = true`. Smooth normals instead of `flatShading` on the log body, and 12 sides at LOD 0 so it
   reads round, not boxy; LOD 2 stays cheap.

## Objectives
- [ ] Handoff file `tasks/handoffs/T-0005-grok-globe.md` and a dated entry in `notes/grok-globe.md` committed before any code, including a one-line note to the props/flora owners (users of the log shape, footprint and mass) about the change. Check: both files are in the branch history before the first code commit.
- [ ] `tests/log-seat.test.ts`: on a sloped sample spot, the log's two ends and middle sit within 0.05 m of the ground minus the chosen sink (20-35 % of the radius), the pitch matches the end-height slope within 1 degree, and the same seed gives the same transform twice. The handoff records that it fails on main before the fix. Check: `npm test`.
- [ ] Seat logs: a `seatLog(group, entity)` in `render/geometry.ts` (or next to `seatRock`) applying pitch, roll and sink from `heightAt` samples as above; `render/buildScene.ts` unchanged apart from the call if one is needed. Check: the test above, and the before/after captures show no floating end on the slope near the start.
- [ ] Bark material: one shared log material with the bark hook built on `proc/glsl.ts` noise (stretched fissures and ridges, normal perturbation, per-log seeded variation through a vertex attribute), smooth normals and 12 sides at LOD 0. Check: the after captures show fissures along the axis at about 3 m and a surface that is not flat brown at about 25 m; `tsc` clean.
- [ ] Keep the near-cascade shadows from `perf6/near-shadows` 4c8d933: logs stay on their own BatchedMesh, which casts into the near cascade only. Check: if 4c8d933 is merged, `render/photoreal.ts` is unchanged and log shadows still appear only near the player; if not, the branch is stacked on 4c8d933 or the bark hook goes on the same `LOG_MATERIAL`, so the two merge cleanly (stated in the handoff).
- [ ] Opt out of surface bands: the log material sets `userData.noBands = true`. Check: with `grok/surface-bands` merged into a scratch branch, `applySurfaceBands` returns false for the log material and logs get no band multiply on top of the bark (one capture).
- [ ] Patch fade and tiers: the log material stays wired through `fadeOptIn` (the in-page descent dithers it like the other props), and the bark is cheap on low tiers through the existing governor (a uniform strength that the Low, Very low and Minimum tiers set to 0). Check: an in-page descent capture at 300 m with the logs dithering in, and the Minimum-tier smoke frame shows plain logs.
- [ ] Performance budget, with the numbers in the handoff: program count after warm-up at most +1 against main at every tier (smoke-tiers' per-tier program-link count, 7d71892); draw calls unchanged (`renderer.info.render.calls` over the same chunk set); log chunk-build cost at most +0.05 ms per log (a node bench of `seatLog` over 1000 seeded logs); smoke-tiers on the branch with no new console or shader errors and no fps loss on any tier against main.
- [ ] Before/after captures from the worktree's own dev server on a separate port (started only for the batch and stopped right after, bench lock held, Edge closed): logs on a slope near the start, close up (about 3 m) and medium distance (about 25 m) at 13:00, saved as `/workspace/logs-before-*.jpg` and `/workspace/logs-after-*.jpg`, each under 300 KB; `tsc`, `npm test` and `npm run build` green; a playable link for Matthew.

## Scope and coordination
- **Files:** `render/geometry.ts` (log recipe, seating and material), `render/batch.ts` (only if the log's extra vertex
  attribute has to survive `flatten`), a new `tests/log-seat.test.ts`, `tasks/` and `notes/grok-globe.md`. Rotating the
  ground-plant footprint in `render/flora/flora.ts:61` with the log's yaw is left to the flora owner; it goes in the note.
- **Not touched:** Claude's animal files (skeleton.ts, species.ts, animalBehavior.ts, body/rig files), the river files, the
  grass/flora shaders, generation in `core/world.ts`, and `render/photoreal.ts` (shadow cascades stay as 4c8d933 leaves them).
- **Coordination:** `perf6/near-shadows` (the log material and its shadows) and `grok/surface-bands` (`noBands`): stack on
  or rebase over whichever lands first. A note for the props/flora owners. Matthew merges.

## Risks
- **Merge order:** 4c8d933 and surface-bands both touch the log material; whichever lands second needs a small rebase.
- **Programs:** an `onBeforeCompile` hook gives the log material its own program key, so +1 program per active variant
  (CSM/PCSS). If photoreal's precompile clones it per tier, a tier switch may show more than one link; smoke-tiers' link
  count shows it.
- **Batch attributes:** a BatchedMesh needs the same attributes on every geometry in it, so the log's extra attribute must be
  on every log geometry (all LODs, the end disc included).
- **Steep ground:** on very steep or bumpy spots a straight log can't touch everywhere; the sink is capped so a log never
  disappears, and the middle sample keeps it from bridging a dip.
- **Shimmer:** thin fissures alias at distance; their contrast fades with `fwidth` and distance.
- **Footprint and mass:** a tilted log keeps the flat 2.25 x 0.45 m footprint and the same mass; unchanged here, noted for
  the owners.

## How a reviewer checks it
1. `npm test`: `tests/log-seat.test.ts` passes.
2. Start the branch and walk to a log on a slope: both ends touch the ground, it is partly sunk, the bark has fissures along
   it and it reads round, not boxy; at 25 m it is still not flat brown.
3. Check the handoff's numbers against the budget objective, and run smoke-tiers once on the branch.