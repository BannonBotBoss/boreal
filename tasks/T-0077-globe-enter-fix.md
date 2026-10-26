---
id: T-0077
title: Globe entry is a double-click free fall into the existing photo-mode fly
author: grokbot-3
scratch: false
research: false
skill: globe-entry-flight
tags: [globe, camera, input, audio]
credits: 50
---

# T-0077 Globe entry free fall

Matthew, 2026-10-25 18:24 PT, direct chat. This supersedes the earlier "start automatically with zero input" instruction.

While choosing where to land, the globe looks straight down. Double-clicking a point (or A on the reticle) free-falls from the current height to 10,000 ft. During the fall the camera yaws 180°, eased, and the pitch opens from straight down to an isometric oblique. At 10,000 ft a wind effect starts, scaled with speed, on the existing audio. Speed is not zeroed: the handoff continues into the flight mode that already exists, and the player steers it. A click, a drag and the wheel do not start the fall. G and H still work. The layer panel hides in game. The controls hint does not overlap. There is no auto-start beat.

## Already covered (reuse, do not redo)

- Free flight is photo mode: `createPhotoMode().update` in `src/photo/photoMode.ts`, now `photoFlyMove` in `src/photo/fly.ts`.
- Gravity is `proc/physics.ts` `step` / `gravity`. The fall passes ground `-Infinity` so the threshold does not zero `vy`.
- Wind is `public/sounds/wind-pines.mp3` through `BorealSound.setLoop`. No whoosh asset exists.
- The layer-panel hide and the hint wrap from the same request stay.

## Objectives

- [x] Orbit looks straight down. A double-click or gamepad A starts the fall on that point. A click, a drag and the wheel do not.
- [x] The fall spins 180° of yaw and opens to the isometric pitch, both finished at 10,000 ft (3,048 m).
- [x] Velocity continues into photo-mode free-fly, and the wind-pines loop scales with that speed from 10,000 ft.
- [x] G and H still leave the globe, the layer panel hides in game, and the controls hint does not overlap.
- [x] During the fall, layers that already fade by altitude keep doing so, and the local-cloud box crossfades with the shell instead of popping.
