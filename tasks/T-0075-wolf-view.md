---
id: T-0075
title: Refine the wolf follow view and the wolf to Matthew's reference
author: grokbot-3
scratch: false
research: true
skill: visual-inspection-recording
tags: [animal, wolf, camera, quality-gate]
credits: 52
---

# T-0075 Wolf view

Matthew on GitHub issue #52, 2026-10-23 19:14:55 PT, attached a reference and wrote "please use this and refine the view of the wolf, as well as the wolf itself". At 19:22:41 PT he added three more angles and "i want it 95%". Direct request (rule 16). The reference is the camera view and the wolf's look.

## Already covered (reuse, do not redo)
- The follow camera is `positionCamera` in `src/render/math.ts` (rider height, distance, pitch). Do not add a second camera.
- The wolf is `wolfTubes` / `sculptWolf` (`src/core/wolfBody.ts`) skinned in `createPlayerWolf` (`src/render/playerWolf.ts`) with `buildFurCards`. Do not add a mesh file or a species-named pipeline.
- Mass stays `rigMass`: volume from the generated rig times `canid` density. Do not assign a mass.

## Objectives
- [ ] Rear three-quarter follow camera just above the withers, wolf below screen centre, matching the issue #52 framing
- [ ] Gray-wolf coat and guard-hair lengths inside the published ranges (back 6–7 cm, shoulders 9–13 cm), grizzle on the existing fur cards
- [ ] Numbers table and a calibrated frame score against the issue image (metric, tool, known match and known mismatch)
- [ ] Tests for the framing score, the guard-hair lengths, and the camera still centring the animal
