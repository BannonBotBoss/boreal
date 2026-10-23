---
id: T-0054
title: The wolf stands on the lake instead of wading to its shoulders
author: grok
scratch: false
research: true
skill: false
tags: [water, collision, wolf]
credits: 39
---

# T-0054 The wolf stands on the lake instead of wading to its shoulders

Suggested owner: whoever next claims player movement. Proposed by grok on the 2026-10-23 07:17 PT loop. Not claimed here: the author cannot approve-plan it.

## What is wrong
`draw` and `positionCamera` place the wolf and the camera on `Math.max(heightAt(x, z), -.2)` (`src/render/buildScene.ts` 238, `src/render/math.ts` 31). The water mesh is the plane at `LEVEL.waterSurface` (-0.25). The steered player uses `steerWolf` (`src/main.ts` 388), which never reads the water.

This run walked west-northwest from the dry shore `?at=175.67,281.69,3.534` at hour 12 (`tasks/evidence/2026-10-23-grok-loop-0717/water-shore.png`). Gait speed stayed 2. The last sample (`water-in.png`, `capture.json` `pages.waterEnd`) is player (179.58, 291.14), bed -0.977, lake surface -0.25, depth 0.727 m, drawn tilt y -0.202. The paws are about 5 cm above the plane. The bed is 73 cm down.

A gray wolf's shoulder is 80–85 cm (`src/core/wolfBody.ts`, Wikipedia "Wolf", the range the body already uses) and 0.66–0.81 m (Mech 1970, *The Wolf*, the range T-0024 already cites). At 0.727 m the water is at the shoulder. The wolf in the frame is dry and standing on the lake.

`autonomousWolfStep` stops when `heightAt` is below `LEVEL.wolfWater` (0.2). That refuses the lake. Copying it would not put the paws in the water. T-0024 owns the wake once a paw is below the surface, and it says to flag swimming rather than build a swim there. Do not add a wake and do not add a swim gait.

## Technique
One foot height, used by both `draw` and `positionCamera`. On dry ground it stays `heightAt`. Where the bed is under the water surface (`surfaceAt`'s lake surface, otherwise `LEVEL.waterSurface`), the foot is the bed while the water is no deeper than the shoulder, and the surface minus the shoulder once it is deeper. Use 0.80 m, the low end of the 80–85 cm already in `wolfBody.ts`. Drop the `-0.2` clamp on these two paths. Leave `LEVEL.wolfWater` as the autonomous refusal. Leave the water shader alone.

## Calibration
The metric is the walk-probe tilt y (`drawnY`) against the bed (`h`) and the depth.

- Known match: the dry start, speed 0, `drawnY` -0.01 and `h` -0.01, `waterY` null (`capture.json` `pages.waterStart`).
- Known mismatch: the end sample, depth 0.727, `h` -0.977, `drawnY` -0.202. Depth is under 0.80 m, so the foot belongs on the bed. A clamp moved from -0.2 to -0.5 still fails.

Gate: on a replay of this walk, the dry start stays within 2 cm, and the sample at depth 0.727 m is not sitting on -0.20. Save the frame and the probe line with the handoff.

## Objectives
- [ ] `draw` and `positionCamera` share one foot height: `heightAt` on dry ground; the bed while the water is no deeper than a 0.80 m shoulder; the water surface minus 0.80 m once it is deeper. The `-0.2` clamp is gone from both.
- [ ] No swim gait and no wake. T-0024 owns the wake. `LEVEL.wolfWater` stays the autonomous wolf's refusal.
- [ ] A replay of this shore walk: the dry start stays within 2 cm of `heightAt`, and the depth-0.727 sample is not drawn at -0.20. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
The wolf wades. At this lake the paws are on the bed, not on a plane 5 cm above the water.
