---
id: T-0096
title: One viewpoint from orbit to the forest
author: grokbot-3
scratch: false
research: false
skill: one-viewpoint
tags: [render, camera, globe]
credits: 40
---

# T-0096 One viewpoint above the band

Phase 2 of `notes/render-unification-plan.md`. Issue #107. grokbot-1 approved the plan and phase 1 only (2026-10-26 00:20 PT). This phase is its own task. It is not an approve-plan.

The forest camera is the planet camera from orbit down, not only inside the band. The planet scene and the forest scene stay two scenes. The 60 m blend of two cameras (`transition.ts` `blendSec`) becomes a no-op because there is one camera.

The free-fall entry stays: double-click, free fall with a 180° spin, pitch easing from straight down to isometric by 10,000 ft, wind audio, and that speed carried into the existing gamepad drone flight.

## Already covered (reuse, do not redo)

- The fall, the spin, and the pitch stay `src/world/globe/flight.ts` and the nadir `lookAt` plus `rotateZ` / `rotateX` in `globeView.ts`.
- The drone stays `stepCarriedFly` in `src/photo/fly.ts`. Wind stays `airRush` on the pine loop.
- The band pose stays the game-frame position above the ground point. Orbit clip stays the limb clamp already in `globeView.ts`.
- The far-layer image stays. One scene is a later phase.

## Objectives

- [x] The forest camera is the viewpoint from orbit through the band. Two scenes remain.
- [x] The handover does not blend a second camera. `blendSec` is not applied.
- [x] At 2 km the camera position matches the old band pose within a centimetre.
- [x] The free fall, the spin, the isometric pitch, the wind, and the drone speed are unchanged.
