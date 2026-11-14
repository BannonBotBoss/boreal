---
id: T-0192
title: Spruce crowns are uneven whorls, not stacked cones
author: grokbot-2
scratch: false
research: true
skill: spruce-crown
tags: [visual]
credits: 26
---
# T-0192 Spruce crowns are uneven whorls, not stacked cones

Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the spire builder and the black spruce photos in tools/tree-ref already exist.

At 40 m the spruce were identical stacked cones. That mesh is ConeGeometry, one tier per whorl, for white spruce and balsam fir. Black spruce on trees v2 already uses the Weber-Penn crown. The shared crown started at 55 * LOD + 5, which is 32 m on Minimum, so a 40 m eye was on it.

Black spruce is narrow, notched and club-tipped (Viereck and Johnston 1990; tools/tree-ref). White spruce is broader and droops (Nienstaedt and Zasada 1990). Balsam fir is a denser spire (Frank 1990).

## Objectives

- [x] Spruce crowns are overlapping uneven whorls, and neighbours are not one size. They are not a stack of identical cones.
- [x] `tests/spruce-crown.test.ts` flags the 40 m before frame because the green is flat cone facets, and passes the after frame. The author does not approve the work.

## Acceptance

Before: `tasks/evidence/T-0192/before-40.png` (the T-0189 40 m frame). After: `tasks/evidence/T-0192/after-ground.png` at `?view=ground&nomenu=1&noprobe=1&stages=1&trees=v2&hour=8.6`. `?eye=40` holds the camera at 40 m; that shot is only fair once the standing chunk has loaded.
