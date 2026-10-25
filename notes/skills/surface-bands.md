# Skill: one noise band chunk on solid untextured materials

Use when a solid object with no colour texture needs darker and lighter bands, and the bands must be one shared shader
rather than a material per object. First used for T-0004 (logs, bark, rocks, props). Needles and leaf cards stay out.

## Steps
1. Search before adding noise. The only shader noise is `proc/glsl` `GLSL_NOISE` (`vnoiseU`, `fbm`). Do not paste a second
   `hash2s` / `vnoise` / `fbm`. `tests/rules.test.ts` fails a new definition. If the material's own hook already includes
   `float vnoiseU(`, do not include `GLSL_NOISE` again (render/bands.ts checks the fragment source).
2. Put the chunk in one module (`src/render/bands.ts`): `wantsBands(material)` and `applySurfaceBands(material)`.
   Inject with `onBeforeCompile` immediately before `#include <alphamap_fragment>`, after every colour edit (tree bark's
   procedural albedo runs in the previous hook). Vertex side: a `vBandW` world position that includes `batchingMatrix`
   and `instanceMatrix`, or batched instances all share the chunk's position.
3. Key the program as `previous key + '|bands'`. For a material still on three's default `customProgramCacheKey`, freeze
   `onBeforeCompile.toString()` first (three keys those materials by the hook source; photoreal's CSM chain and precompile
   clones then take the custom-key path). Call `applySurfaceBands` before `fadeOptIn`: fade keeps a key that is already
   custom, so the key stays `|bands` and the fade patch still wraps the hook.
4. Call it from the one place every batched material passes through (`render/batch`, inside `buildJob`, before
   `fadeOptIn`). Do not call it from terrain (`render/pbr`) or from animal rigs. A material opts out with
   `userData.noBands = true` (logs with their own bark, rocks with their own mineral bands, the wolf rig). A material that
   mixes surfaces sets `userData.bandsMask` to a GLSL float expression (trees: `(1. - step(0.5, vLeaf))`, bark only).
5. `?bands=0` turns the chunk off. `?bands=<amp>` with `0 < amp <= 0.5` sets the half-range. The plan's default half-range
   is 0.15, so diffuse is multiplied by 0.85-1.15. Matthew owns whether the shipped default stays on. The spec says the
   preview branch is on.
6. Check the numbers against a published source before calling them natural. Spacing is
   `2 / (BAND_FREQ * |dot(direction, BAND_AXIS)|)` metres (`bandCycleM`). Contrast is the clamp bound `1 ± amp`, not the
   value of every pixel. Record the source, and say when the source measured a different thing (between trees vs along
   one trunk; bark plates vs decimetre veins).

## Checks that proved it
- `tests/bands.test.ts`: a solid untextured standard, lambert or phong material gets the chunk; transparent, alphaTest,
  alphaToCoverage, map, alphaMap, noBands, shader, sprite, line and points do not. Three materials share one key. A custom
  key becomes `that key + '|bands'`. The patch is injected once. `GLSL_NOISE` is included once, and skipped when
  `vnoiseU` is already there. The tree mask is compiled into the multiply. `fadeOptIn(..., true)` does not replace the key.
  `LOG_MATERIAL` and `ROCK_MATERIAL` opt out. `PROP_MATERIAL` opts in. `?bands=0` parses off. The default bound is
  0.85-1.15. `bandCycleM` matches the sine period.
- `npx tsc --noEmit` and `npm test`.
- In the running game, `?bands=0` against the same `?at=` is the before/after. Count program links (hook `linkProgram`)
  and shader sources that contain `float bt =`. The link count should rise by at most the number of base materials; a
  rise of 0 is allowed, because the patched program replaces the plain one. CSM and the post routes still multiply variants.
- Frame and GPU milliseconds within 5% at Ultra and Medium are the omen measurement: bench lock, vsync off, `?bench=1`
  with and without `?bands=0`. A SwiftShader or software-renderer run is not that measurement.

## Mistakes to avoid
- A per-object program key. The key is one string per base material.
- Stacking this chunk on a bark or rock material that already draws its own pattern. Those set `userData.noBands`.
- Bands in object space. A moved or batched instance would slide or share the wrong origin. Use the world position after
  the batching matrix.
- Treating a between-tree reflectance CV as a within-trunk band measurement. Cite what the paper actually averaged.
- Calling a headless software-renderer frame time the omen 5% gate. Label it as a substitute, or leave the gate open.
- Editing `render/pbr.ts` or animal rigs to push this chunk through. Terrain and animals are excluded. The wolf already
  sets `userData.noBands` because a world-space pattern would slide across a moving body.
