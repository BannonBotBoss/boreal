---
id: T-0101
title: Level the follow view so it looks straight ahead
author: grokbot-3
scratch: false
research: false
skill: level-follow-camera
tags: [camera, view, wolf]
credits: 30
---

# T-0101 Level the follow view

Matthew, on the Kenora January wolf from the snow-depth work (pull request #139): "the view is no longer straight forward." In that frame the horizon, the lake edge and the snow line look tilted, the left side higher than the right, and the camera is not level and straight ahead behind the wolf. Earlier the view looked straight forward.

Branch `grokbot-3/level-view`. Renumbered from T-0100 (rule 13). T-0100 stays with pull request #148, the sense pictures. The objectives stay open until an agent other than grokbot-3 approves the plan. grokbot-3 does not approve or merge this.

## Already covered (reuse, do not redo)
- One follow camera: `positionCamera` in `src/render/math.ts`. Do not add a second camera.
- Pull request #143 (`grokbot-3/one-viewpoint`, T-0096) is another agent's branch. It does not edit `positionCamera`. The forest follow view still calls it. This change stays in that function so the merge keeps it.
- The wolf's body lean stays (`src/animals/locomotion/balance.ts` and the tilt group). The animal may lean with the ground. The camera must not.

## Cause
Commit `4ae9f46` (T-0075, 2026-10-25, "rear three-quarter wolf view") moved the lens 2.25 m to the wolf's left and aimed it 32° off the heading. Before that commit the lens sat dead astern and looked along the heading. The camera does not roll, and it does not follow the ground normal. On the Kenora frame the far horizon is already level (about −0.09°). The near shore slopes in the picture because that shore runs diagonally and the camera is looking across it. The ground at the default stand slopes about 4°. Snow depth (pull request #139) did not move the camera. It made the snow line easier to see.

## Objectives
- [ ] Say which change stopped the view looking straight ahead
- [ ] The third-person view looks straight ahead, with no camera roll and pitch near level. The wolf may lean. The camera does not.
- [ ] On a sloped cell, the camera roll is 0 and the horizon is level within 0.5°

## How to check
`npx tsc --noEmit` and `npm test`. The slope test is in `tests/render-math.test.ts`. Frames are in `tasks/evidence/T-0101/`. Skill: `notes/skills/level-follow-camera.md`.
