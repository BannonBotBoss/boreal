---
id: T-0035
title: Interaction target highlight: a soft glowing outline tracing the object replaces the yellow ground ring
author: grok
scratch: false
research: false
skill: target-outline-glow
tags: [ui, render, interaction]
credits: 20
---
# T-0035 Glowing outline on the interaction target

Matthew asked for it (2026-10-22 00:38 PT, screenshot of the ring around a Practice herb): "instead of a yellow circle
surround the area of an object, id rather have a glowing outline tracing the object."
Branch: `grok/interact-outline` (worktree C:\dev\boreal-grok-outline, from main a436a9d).

## How it works now (main a436a9d)
- `render/buildScene.ts:91`: one `RingGeometry(1.6, 1.85)` cream ring (0xffe9a1, opacity .7) laid on the ground under the
  highlighted entity (`focus ?? target`), scaled to rock size for rocks. Targets: every entity with an available action
  (`core/events.ts availableActions`): plant (gather), forage (forage), deer (speak), person, rock (move), log.
- Static entities are merged into a per-chunk BatchedMesh (`render/batch.ts`), deer are live rigs, persons/pushed rocks LODs.

## Plan (reuse, minimal)
- Reuse three r180 `OutlinePass` (examples/jsm/postprocessing, MIT): edge detect on a selection mask, 2-level separable
  blur, additive overlay. Not inserted into render/post's composer (bypassed in normal play, so it would force the full
  half-float composer on whenever a target exists, and OutlinePass's depth prepass re-renders the whole scene).
- Instead it gets its own one-object scene: a proxy of the target only. Static (batched) entities: `generateGeometry(entity, 0)`
  (the exact geometry the batch flattens, LOD 0) placed at the entity. Live rigs (deer) and LODs (persons, pushed rocks):
  meshes that share the source geometry and copy the source's matrixWorld each frame. After `post.render`, the pass's
  overlay is blended additively straight onto the canvas (readBuffer = null): no composer, no full-scene redraw.
- Soft warm colour (0xffd89a), thin edge + wide glow, no pulse; hidden in photo mode. The ring is removed.

## Objectives
- [ ] 1. Ring removed; the highlighted entity (herb, berry bush, deer, rock, log, person) gets a glow tracing its silhouette
- [ ] 2. Frame-time cost measured (?bench or the perf HUD) with and without a target; under 0.5 ms on omen
- [ ] 3. Before/after screenshots of herb, berry bush and deer; tests, tsc, handoff, skill
- [ ] 4. Held focus (scope addition, Matthew ~01:00 PT): focus engages only while gamepad LB (keyboard F) is held and an
      interactable object is within 12 m ahead; moving forward steers the wolf toward it at the 2.2 rad/s turn rate (no snap);
      leaving the radius or releasing drops it; the glow marks the focused object. Super stealth no longer auto-focuses.

## Numbers
| value | game number | real figure + source | resemble? |
|---|---|---|---|
| focus radius | 12 m (core/focusLock FOCUS.radius) | N/A: game-feel distance, 2 x the 6 m interaction reach (core/events) | N/A |
| focus turn rate | 2.2 rad/s (the existing full-stick steer rate, main.ts) | N/A: reused game constant, not new | N/A |
| glow | UI overlay, no world quantity | N/A: a UI highlight is not a natural object (rule 11: unmeasurable, no nature figure applies) | N/A |