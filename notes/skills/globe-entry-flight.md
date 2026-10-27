# Skill: globe entry is a free fall into the existing photo-mode fly

When to use: the planet view should enter the forest, the camera should fall, or a "drone" / free-flight control is asked for.

## Search before writing flight code

The only free-flight already in the repo is photo mode.

1. Search `src` and `git log -S` for fly, drone, freecam, free camera, spectator, flight, noclip, and the camera menu.
2. The hit that flies is `createPhotoMode().update` in `src/photo/photoMode.ts` (commit b4a2ace). It is kinematic: WASD, Q/E or Space/Ctrl, Shift 25 m/s else 6 m/s, drag look, floor `max(heightAt, -0.25) + 0.3`.
3. That move lives in `src/photo/fly.ts` as `photoFlyMove` / `photoFlyFloor`. The globe calls `stepCarriedFly`, which adds a carried velocity first and then the same move. Turn (yaw and pitch) is part of `photoFlyMove`. The Xbox pad uses the drone bindings through `photoFlyStick` (the router) and `photoFlyPad` (photo mode): left stick moves, right stick turns, right trigger climbs, left trigger descends. Do not enter photo mode for the descent (it freezes the world and opens the photo UI). Do not write a second integrator. Gravity is `proc/physics.ts` `step`.
4. The camera panel (`src/ui/cameraPanel.ts`) is exposure and filters. `src/camera/gameCamera.ts` is the viewfinder. Adaptive-music "drone" is not a camera.

## How entry works

1. Orbit looks straight down (`NADIR` in `src/world/globe/flight.ts`). Wheel zooms. Drag orbits. A single click does nothing.
2. A double-click on the planet (`globeView` `beginFall` via `pickSurface`) or gamepad A / G starts a free fall on that point. A drag cannot become the double-click (`thisMoved` / `prevMoved`).
3. The fall uses `physics.step` with ground `-Infinity` so crossing 10,000 ft does not zero `vy`. `FALL_END_M` is `10000 * 0.3048` (NIST SP 811).
4. Yaw adds 180° and pitch goes from nadir to `ISO_BELOW_HORIZON` (`-atan(1/√2)` ≈ −35.264°, Carlbom and Paciorek 1978). Both use smoothstep `fallEase` and are finished at `FALL_END_M`. Aim with `lookAt(0,0,0)`, then `rotateZ(-azimuth)` and `rotateX(pitch − nadir)`. `planet.north` is world +Y projected on the tangent plane, and that lookAt keeps camera +Y there, so the negation is the compass heading. A second `lookAt` with a built view vector left the tiles off the centre pixel. The far plane is `sqrt(max(0, rad² − R²)) + 2R`: the hydrostatic figure sits inside the mean sphere, and once the fall crosses that sphere the unclamped radical is NaN, the projection is NaN, and the frame clears to `0x02040a`.
5. `leave({ x, z, yaw, vy })` hands that speed to `inpage.descend`. `stepCarriedFly` keeps moving with zero input. The photo floor stops the body later; it does not stop the camera at the handoff.
6. Wind is the existing `wind-pines` loop. `rushLevel` in `src/audio/borealSound.ts` scales it. `main.ts` does not halt the context while `inpage.airRush()` is above 0. There is no whoosh asset.
7. G or pad A on the drone becomes the wolf. Esc or pad X returns to orbit (`resumeOrbit`, no auto re-fall). H still flies home and does not drop. There is no auto-start beat.
8. Altitude fades that already exist keep running through the fall: `visibleWeight` (snow, ice, soil), `DETAIL` (5 km to 2.5 km), `cloudClear` (1500 km to 150 km), `patchFade` (2 km to 600 m). The local cloud box used to pop on at `showBelowM` (40 km). `localCloudFade` eases it to 1 at `sizeM` (32 km), and the shell's clear is `cloudClear * localCloudFade` so the two crossfade. Do not add a renderer. PR #94 is the unification plan.

## Checks

- `tests/flight-entry.test.ts`: gesture, ease/yaw/pitch at `FALL_END_M`, `stepCarriedFly` moves by `vy * dt`, photo mode and inpage call the same fly.
- `npx tsc --noEmit` and `npm test`.
- Frames: `node refs/globe-entry/capture.mjs <port> refs/globe-entry/frames` on `?start=globe&stages=1&trees=v2`. Log elevation (`look · up`). Nadir is about −90°. The end of the fall is about −35°. A click and the wheel leave `fallState` null.

## One viewpoint (T-0096)

The forest camera is that viewpoint from orbit down, not only inside the band. `attachViewpoint` maps it onto the planet camera when the round trip is within a centimetre. Off the home-facing hemisphere the fall's own `lookAt` / `rotateZ` / `rotateX` stays, so a far-side orbit does not get a broken gnomonic pose. `handoverBlend` does not mix a second camera, and `blendSec` is not applied. Two scenes remain. Do not put the blend back.

## Mistakes to avoid

- Do not time-compress gravity. From the default orbit the speed at 10,000 ft is orbital-fall speed. Zoom closer with the wheel, then double-click, when the capture needs a readable fall (`jumpTo` around 5 km is about half a minute).
- Do not aim the fall with a second `lookAt`. Stay on the nadir `lookAt` and `rotateX` / `rotateZ`.
- Do not take the limb distance as `sqrt(rad² − R²)` without `max(0, …)`. Inside the mean sphere that is NaN and the globe clears.
- Game yaw is the negation of the globe look azimuth (`headingYaw`). Pass `-fallYaw(...)`.
- Do not clamp the drone to `INPAGE.capH`. The patch fade still waits on chunks; the camera keeps the fall speed.
- Do not `landSpawn` the clicked point onto a different spot.
- `body.on-globe` hides the wolf hint. The entry line is `#flight-prompt`. Do not remove that hide to "fix" the hint.
- Gamepad A does not count as an audio gesture. A double-click does, because `BorealSound` starts on `pointerdown`.
