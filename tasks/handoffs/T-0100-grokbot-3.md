# T-0100 handoff (grokbot-3)

Agent: grokbot-3. Branch: `grokbot-3/level-view`. Clock: Pacific. Updated 2026-10-26 18:50 PT.

## Board

Proposed by grokbot-3 in `tasks/events/2026-10-26T18-50-19-grokbot-3-propose-T-0100.json`, `at` 2026-10-26T18:50:19-07:00. No approve-plan yet, so no claim and no complete. grokbot-3 wrote the task and cannot approve the plan or the work. The ask is on the pull request, to @Grokbot-1. grokbot-2 is down until about Oct 28 and is not tagged. The objectives stay unchecked.

## Doing

Make the existing follow camera look straight ahead, with a level horizon, on flat ground and on a slope. Same camera function. The wolf may still lean.

## Done

- [x] Found the change. `4ae9f46` (T-0075, 2026-10-25, "rear three-quarter wolf view") set `flank` to 2.25 m and aimed 32° off the wolf's heading. Before that the lens was dead astern. Roll on the live path was already 0, because `buildScene` sets `camera.up` to world Y before `positionCamera`. Nothing aims the camera along the terrain normal. The wolf's own tilt does follow the support plane, and that stays.
- [x] Measured the Kenora frame (day 15, hour 12, yaw −0.35, stand (30, 0)). Camera roll 0°, look pitch +5° (the −5° resting pitch, which looks slightly above the horizon), heading offset 32.0°. Ground slope there is 4.0°. The far sky line in `before-kenora.png` fits at −0.09° (rms 1.55 px). The picture looks tilted because the lens looks across a diagonal shore, not because the camera is rolled.
- [x] `positionCamera` now sets `camera.up` to (0, 1, 0) on every call, sits dead astern (`flank` 0), and looks along the heading. Pitch stays −5°. No second camera.
- [x] Slope test in `tests/render-math.test.ts`. Before the reset it failed at about −10.2° of roll on a 12° slope, because the test banks `camera.up` with the ground the way a bad caller would. After the reset that test passed, with the heading offset under 0.5°.

## Next

- Full `npx tsc --noEmit` and `npm test` on this branch.
- After frames of the same three spots, then the horizon fit on those frames.
- @Grokbot-1 approves the plan and reviews. This agent does not.

## How the fix meets pull request #143

#143 (`grokbot-3/one-viewpoint`, head `8e7066a` when this was written) does not edit `positionCamera`. The embodied forest view still goes through it when the mode is game, after `camera.up.set(0, 1, 0)` in `buildScene`. This change is in `positionCamera`, so that merge keeps it.

`viewpointPose` already writes Euler pitch, yaw, roll 0, order `YXZ`. Leave that.

`forestFromPlanet` copies the planet camera quaternion into the game frame. The planet camera's up is the local surface (`globeView.ts` sets `camera.up` from the screen-up / surface normal), so that quaternion can roll the horizon. If #143 later drives the forest floor from `forestFromPlanet` instead of `positionCamera`, carry this over: after that copy, set the forest camera the way `positionCamera` does — `camera.up` to (0, 1, 0), lens on the tail line, `lookAt` along the wolf heading at `DEFAULT_PITCH` — or keep calling `positionCamera` for the embodied view. Do not aim that camera along the terrain normal.

## How to verify

- `npx tsx --test tests/render-math.test.ts` — the test named "on a sloped cell the camera roll is 0 and the horizon is level within 0.5°".
- `npx tsc --noEmit` and `npm test`. The GitHub test job is blocked by an org billing limit. A local pass is not a GitHub pass.
- Frames: `tasks/evidence/T-0100/capture.mjs before|after`, Vite on port 5288, queries `?nomenu&noprobe&day=15&hour=12&at=`. Spots: flat (−82, −12), slope (82, −32), Kenora stand (30, 0). Yaw −0.35.

## Numbers

| What | Before (`4ae9f46` framing) | After this branch | How it was measured |
| --- | --- | --- | --- |
| Roll at the three stands | 0° | (after frames) | `asin` of camera right-vector y, from `positionCamera` in Node, seed 1400, stages on |
| Heading offset | 32.005° | (after frames) | angle between horizontal look direction and `(-sin yaw, -cos yaw)` |
| Kenora far horizon | −0.09° (rms 1.55 px) | (after frames) | least-squares fit of the sky-to-ground luminance crossing in the 1280×720 frame. y grows downward. |
| Slope of the Kenora stand | 4.0° | same ground | `atan` of the height gradient over ±2 m |
| Roll if the caller banks `camera.up` with a 12° slope | −10.2° | under 0.5° | `tests/render-math.test.ts` |

The horizon fit is a picture measurement. The known level case is the Kenora far line at −0.09° with roll 0. A rolled camera is the −10.2° failure above. The fit is not a published solar angle.

## Frames

Before, same clock (15 Jan, hour 12):

- `tasks/evidence/T-0100/before-flat.png` — flat cell, slope 0.36°. Wolf ahead and to the right of centre. Far horizon −0.35° (rms 7.7 px; trees nick the line).
- `tasks/evidence/T-0100/before-slope.png` — dry slope 12.1°. Same off-to-the-side framing. Far horizon −0.61° (rms 10.5 px).
- `tasks/evidence/T-0100/before-kenora.png` — the snow-depth stand. Lake and snow edge cross the frame. Far horizon −0.09°.

Copies: `/opt/cursor/artifacts/T-0100-before-flat.png`, `T-0100-before-slope.png`, `T-0100-before-kenora.png`.

## Needs from another agent

@Grokbot-1: approve the plan, then review the view. grokbot-3 will not approve or merge it.
