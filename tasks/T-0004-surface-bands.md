---
id: T-0004
title: Surface bands - noise-driven darker/lighter bands on solid untextured objects (logs, bark, rocks, props), one shared shader chunk
author: grok
scratch: false
research: false
skill: surface-bands
---
# T-0004 Surface bands

**Asked by Matthew (2026-10-19, 06:28 PT):** a global surface layer. Every solid object whose material has no colour
texture gets a noise-driven colour change, so darker and lighter bands run across its surface. He named fallen logs and
tree trunks (bark) specifically; needles and leaf cards stay out.

## Reused, not new
- `proc/glsl` GLSL_NOISE (`vnoiseU`, `fbm`): the only noise, no new hash.
- The `render/fade` pattern: wrap onBeforeCompile and freeze a default key as `prev source + '|tag'`, so photoreal's
  CSM chain and precompile clones take the custom-key path.
- `render/batch` is the one place every batched material passes through (props/logs, rocks, trees), right before fadeOptIn.

## Plan (smallest)
`src/render/bands.ts`: `wantsBands(m)` and `applySurfaceBands(m)`. The fragment chunk goes in just before
`#include <alphamap_fragment>`, after all colour work, including tree bark's procedural albedo. It multiplies the diffuse
colour by 0.85-1.15 using world-position bands along an oblique axis, with low-frequency warp and a little fBm. It is
deterministic, with no time input. The key is `prev + '|bands'`, which gives one program per base material (no per-object
programs). `userData.noBands` opts out; `userData.bandsMask` (a GLSL float) limits mixed materials (trees: bark only).
`?bands=0` turns it off. Matthew decides on the default: it is ON on the preview branch only.

## Objectives
- [ ] render/bands.ts applySurfaceBands + the one chunk, called from render/batch; trees.ts bark mask; ?bands switch
- [ ] tests/bands.test.ts: a solid material without a map gets bands; transparent, alphaTest, mapped or noBands materials do not; the key is stable and shared
- [ ] verify on omen (bench lock, vsync off): smoke passes, program count rises by at most the number of base materials, Ultra and Medium frame/GPU ms within 5%, before/after captures of a log and a trunk

## Acceptance
Matthew's list: tsc clean, npm test passes, the selection test, smoke with vsync off, the program count, and frame/GPU ms within
5% at Ultra and Medium. Captures go to /workspace/bands/ on the box.

## Owners and coordination
Terrain (Claude), the wolf coat and other animals (Codex): excluded. They are not batched through render/batch, and any
owner can opt out with `userData.noBands`. Globe Builder (grok-globe/log-grounding-bark): a bark material that ships its
own pattern sets `userData.noBands = true` so the two layers don't stack.