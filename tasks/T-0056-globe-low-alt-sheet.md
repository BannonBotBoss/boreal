---
id: T-0056
title: Standalone globe at 3000 m is a flat cloud sheet over terrain the tiles already draw
author: grok
scratch: false
research: false
skill: false
tags: [globe, clouds, startup]
credits: 30
---

# T-0056 Standalone globe at 3000 m is a flat cloud sheet

Issue #43 (Matthew, Bannon-github, 2026-10-23 10:09 PT). His screenshot is `?start=globe&stages=1&trees=v2&view=globe&at=30,0,-0.35&alt=3000`: a flat beige plane, HUD ground 371 m, 140 tiles drawn on Medium. The Earth view he asked for is the globe already on main. This task is the hole in that view. Not claimed here.

## What is wrong
`?view=globe` is the standalone globe (`src/world/globe/entry.ts` loads `startGlobe`). `startGlobe` calls `createGlobe` with `shared: false` (`globeView.ts` 83). The cloud deck opens only on the in-page path: `globeView.ts` 404 runs `setClear(cloudClear(alt))` only when `opts.shared`, and the comment there says the standalone keeps the deck.

`uCloudClear` starts at 0 (`atmosphere.ts`). The shell is `CLOUDS.heightKm` 2.5, `cellKm` 900, albedo 0.8. At 3000 m the camera is about 500 m above that shell and looks near the horizon (`-Math.atan(0.08)` when `?at` carries a yaw and the globe is not shared). One cell fills the ground half. `cloudClear(3000)` is already 1: `CLOUD_OPEN` runs from 1500 km to 150 km (`transition.ts`). T-0041 owns that fade for the in-page descent. It does not run on this URL.

## Technique
Call the existing `setClear(cloudClear(alt))` on the standalone globe as well. Do not add a cloud shader, a new shell height, or another globe library. Tiling stays the cube quadtree (`cube.ts`, `lod.ts`, `tile.ts`). Drag stays three.js `OrbitControls` (MIT, `node_modules/three/LICENSE`). The in-page `CLOUD_OPEN` range and T-0043's coast stay. `?atmos=0` stays the switch that removes the whole atmosphere.

## Calibration
Lower half of the canvas (y from 55% to the bottom), viewport 960×540. Beige is R>170, G>150, B>110, R+15>G, G+10>B. Luma is 0.2126 R + 0.7152 G + 0.0722 B.

- Known mismatch: `tasks/evidence/2026-10-23-grok-loop-1016/alt3000.png`. Mean RGB 200.7, 197.4, 188.8, luma std 2.0, beige fraction 1.000. SwiftShader auto-tier Very low, 2 cloud octaves, tiles drawn 44, queued 0 (`capture.json` `hudAlt3000`). Matthew's Medium frame (140 tiles) is the same sheet.
- Known match, clouds off: `alt3000-atmos0.png`. Mean 33.7, 40.8, 34.8, luma std 15.9, beige 0.
- Known match, zero cloud octaves: `alt3000-tier5.png` (`?tier=5`, Minimum, `CLOUDS.octaves` 0). Mean 33.4, 40.4, 34.6, luma std 15.7, beige 0. Aerial perspective alone is not the sheet.

Gate: replay the issue URL with the atmosphere on. The lower-half beige fraction is not 1 and the luma std is not 2. A sheet that only thins (alpha fade, clear still 0) fails: T-0041 already recorded that the home cell is a flat translucent sheet. Orbit (`orbit.png`, no `alt`) still shows the disc. `npm test` and `npx tsc --noEmit` pass.

## Objectives
- [ ] Standalone and in-page both call `setClear(cloudClear(alt))`. No new cloud field and no new planet mesh.
- [ ] The issue URL with the atmosphere on is not the flat sheet. Lower-half beige fraction and luma std move off the mismatch above and toward the open-ground frames.
- [ ] The default orbit disc, OrbitControls drag, the T-0043 coast, and the in-page `CLOUD_OPEN` range stay. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
At 3000 m over home the ground that `?atmos=0` already draws is visible with the atmosphere on. Issue: https://github.com/Bannon-github/boreal/issues/43
