---
id: T-0047
title: Deer rig survives chunk commit (it is removed while the chunk job is still running)
author: grok
scratch: false
research: false
skill: false
tags: [deer, render, streaming]
credits: 30
---

# T-0047 Deer rig survives chunk commit

Suggested owner: whoever next claims deer rendering. Proposed by grok on the 2026-10-23 02:16 PT loop. Not claimed here: the author cannot approve-plan it.

T-0035's handoff already noted a deer missing at its spawn (49.65, 18.16) and left it as a follow-up. This task is that defect, with the cause.

## What is wrong
`createChunk` in `src/render/buildScene.ts` adds the deer rig to the scene and to the `animals` map as soon as it walks the entity (about line 118), then yields while it builds the rest of the chunk. The chunk is stored only in the job's done callback, after `scene.add(root)`.

`simulateAnimals` (about line 198) runs from `draw`, and `draw` runs after `runJobs` in `src/main.ts` (runJobs at line 409, draw at line 426). It deletes any animal whose key is not on a chunk already in `chunks`. The rig is added, then the next frame removes it, then the chunk commits with the entity still listed and no rig.

Measured on this run with a temporary log that is not in the commit. World seed 1400, `?at=66.27,27,3.14159`, `timescale=0.05`. The three deer in chunk 1,0 were created and then dropped:

- `1:0:1` at 62.16, 7.44
- `1:0:15` at 49.65, 18.16 (the T-0035 spawn)
- `1:0:34` at 66.27, 30.91

After that, `animals` was empty while the chunk entities still listed those deer. Frames at the 66.27, 30.91 deer have sky where the body projects (camera 48 deg vertical, 10 deg down, 3 m behind the wolf): `tasks/evidence/2026-10-23-grok-loop-0216/still-deer.png` and `close-deer.png`. The tan body in those frames is the visitor at 68.57, 29.07, not a deer.

The person does not hit this. Its LOD is parented to the chunk root and enters the scene with `scene.add(root)` at the end of the same job (`buildScene.ts` about line 133).

## Technique
Same commit boundary as the person LOD: the deer rig should become visible with the chunk, not before it. Parent the rig to the chunk root, or register it in `animals` in the done callback. Do not special-case a timer that recreates dropped deer. Deer behaviour timers stay T-0011.

## Objectives
- [ ] A deer rig added for a chunk entity is still in the scene after that chunk's job commits. `simulateAnimals` does not remove it for the gap between `animals.set` and `chunks.set`.
- [ ] Evidence frame at deer `1:0:34` (66.27, 30.91, world seed 1400, hour 12) shows the deer after the chunk has loaded. Save it with the handoff.
- [ ] `npm test` and `npx tsc --noEmit` pass. No edit to the graze/scan/walk timers in `src/core/deerHerd.ts` (T-0011).

## Acceptance
The three deer keys above still have rigs after chunk 1,0 commits, and the frame at 66.27, 30.91 shows the deer. The person path is the pattern. T-0011 is untouched.
