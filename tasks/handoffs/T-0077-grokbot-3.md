# T-0077 handoff (grokbot-3)

Branch: `grokbot-3/globe-enter-fix`. Not merged. Not self-approved on GitHub.

## What was built

Globe entry is a free fall into the photo-mode fly that already existed.

- Orbit looks straight down. Double-click (`globeView` `beginFall` / `pickSurface`), gamepad A, or G starts it. A click, a drag, and the wheel do not. H cancels a fall and flies home. No auto-start beat.
- The fall is `proc/physics.ts` `step` with ground `-Infinity`, down to `FALL_END_M` = 10000 × 0.3048 m. Yaw +180° and pitch to `ISO_BELOW_HORIZON` (−35.264°) both finish there (`fallEase`).
- Aim is the nadir `lookAt(0,0,0)`, then `rotateZ(-lookAz)` and `rotateX(fallPitch − NADIR)`. The far plane clamps the limb radical (`Math.max(0, rad² − R²)`) so a camera inside the mean sphere does not get a NaN projection and a cleared frame.
- `leave({ x, z, yaw: -fallYaw, vy })` starts `inpage` `descend`, which calls `stepCarriedFly` (`src/photo/fly.ts`). Photo mode's `createPhotoMode().update` calls the same `photoFlyMove`. The drone is not photo mode.
- Wind is `rushLevel` on the existing `wind-pines` loop, from the drone phase (at and after 10,000 ft). `main.ts` does not halt audio while `airRush()` > 0.
- Issue #107: `localCloudFade` eases the local cloud box from `showBelowM` (40 km) to `sizeM` (32 km). The shell clear is `cloudClear(alt) * localCloudFade(alt)` while that mesh is visible. `visibleWeight`, `DETAIL`, `cloudClear`, and `patchFade` already fade every frame. No new renderer. PR #94 is untouched.

## Root cause of the stuck planet screen

Shared `autoHandoff` is false. G and pad land used to call `leave` only when `overHome`. H only flew home. The in-page frame entered only when already descending, over home, and under the band. Zooming away never handed off. PRs #86–#89 were not the blocker. The old descent was `inpage` `glide` (camera on a 45° path) with `globePitch`. That path is gone. The climb back still uses `globePitch`.

## Number table

| Value | Game | Real figure | Source | Match |
| --- | --- | --- | --- | --- |
| Fall ends | 3048 m | 10,000 ft = 3048 m exactly | NIST SP 811, 1 ft = 0.3048 m | yes |
| Pitch at the end | 35.264° below the horizon | arctan(1/√2), the isometric (1,1,1) view | Carlbom and Paciorek, ACM Computing Surveys 10(4), 1978 | yes |
| Yaw through the fall | +180°, smoothstep | the requested spin | Matthew, 2026-10-25 | yes |
| Wind reference | 54 m/s | belly-to-earth terminal ~120 mph (53.6 m/s) | USPA | verify |
| Local-cloud crossfade | 40 km → 32 km | the box's existing `showBelowM` and `sizeM` | `LOCAL_CLOUDS` game calibration | yes, no new distance |
| Gravity | `GM/r²` via `physics.step` | the sim's one integrator | `src/proc/physics.ts` | yes |

## Frames

`node refs/globe-entry/capture.mjs 5275 refs/globe-entry/frames` on `?start=globe&stages=1&trees=v2&noprobe`. Headless Chrome, swiftshader. Measured 2026-10-25.

| Frame | What the probe and the center 80×80 mean |
| --- | --- |
| 01 orbit | elevation −90°, altitude ~14,016 km, center (17, 35, 57) |
| 02 before the double-click | elevation −90°, altitude 5200 m, center (37, 47, 41). A click and the wheel left `fallState` null |
| 03 early fall | center (37, 46, 39), hash `512cc4f8…` |
| 04 mid fall | center (37, 47, 39), hash `df97a0b7…` |
| 05 late fall | center (31, 40, 37), hash `bd3a7fc3…` |
| 06 handoff | mode band, `__inpage.height` 3048 m, elevation −35.264° |
| 07 still the drone | height 2924 m, same elevation, so the camera was still descending |
| 08 / 09 at 750×900 | prompt/legend overlap 0, talk/legend overlap 0, hint/legend overlap 0. `#globe-layers` hidden in game |

03, 04, and 05 are three different images. Before the far-plane clamp they were one file, md5 `6ca9d8e8`, center about (10, 14, 22), which is the clear color `0x02040a`. The 95% resemblance-to-nature score is unmeasurable on this capture: swiftshader held the Minimum tier, and there is no calibrated reference strip. The measured checks are the elevation, the 3048 m handoff, the distinct fall frames, and the unit tests.

## How to verify

- `npx tsc --noEmit` exit 0.
- `npm test`: 786 tests, 772 pass, 0 fail, 14 todo.
- `tests/flight-entry.test.ts` locks the gesture, the ease, `stepCarriedFly` moving by `vy * dt`, the photo-mode reuse, the rotate aim, and the clamped far plane.

## Flight mode that was reused

`src/photo/photoMode.ts` `createPhotoMode` `update`, extracted to `src/photo/fly.ts` `photoFlyMove`. Searched `src` and `git log -S` for fly, drone, freecam, free camera, spectator, flight, noclip, and the camera menu. The only hit that flies is photo mode (commit b4a2ace). Adaptive-music "drone" is not a camera.

## Rule 15

This run did not review T-0072, T-0073, or T-0078. T-0078 is this agent's render-unification plan (PR #94) and is documents-only. Not a claim that those reviews are done.

## Needs from another agent

None for the behavior. Do not merge this branch from here, and do not set `agent-review` approve on it (own work).
