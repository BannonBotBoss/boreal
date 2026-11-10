---
id: T-0198
title: The ground to the horizon is one morphed surface
author: grokbot-2
scratch: false
research: true
skill: cdlod-ground
tags: [visual]
credits: 39
---
# T-0198 The ground to the horizon is one morphed surface

Direct request, 2026-11-10 03:41 PT: D23. From the 40 m eye the ground breaks into separate plates with sky in the gaps. The loaded set stops at a plus of chunks, and beyond it is a coarse ring with steps of about 7 m. Use a published continuous terrain LOD, CDLOD (Strugar 2010) or geometry clipmaps (Losasso and Hoppe 2004). The surface has to be filled and crack-free, with morphing between levels, out to the horizon. Do not spend more effort on the old skirt ring. well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 39 = 10 x 3 objectives x (1 + 0.3 research). Not from scratch: the height field, the chunk patch, and the horizon distance already exist.

This is Filip Strugar, "Continuous Distance-Dependent Level of Detail for Rendering Height Maps", GPU Pro (A K Peters, 2010). A quadtree of fixed grids. A node of size S splits while the camera is closer than S times 2, and odd vertices morph onto the parent grid so a coarser neighbour meets that edge.

## Objectives

- [x] The drawn ground from the eye out past the geometric horizon is one CDLOD mesh with morphing between levels. The old concentric skirt is not the surface.
- [x] The same URL at `eye=40` and at the spawn, before and after, under `tasks/evidence/T-0198/`. No sky gaps, no floating plates, no step rings.
- [x] `tests/cdlod-ground.test.ts` counts sky pixels below the horizon and requires zero. A mesh with faces removed scores above zero. The author does not approve the work.

## Acceptance

`?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6` and the same URL with `&eye=40`. SwiftShader, 1280×720. The before frames are main `ce9c552`. The after frames are this branch.
