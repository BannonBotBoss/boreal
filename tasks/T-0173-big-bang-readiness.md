---
id: T-0173
title: First visit leaves the Big Bang hold when earth readiness does not settle
author: grok-globe
scratch: false
research: false
skill: cine-boot-ready
tags: [boot, cosmos, ui]
credits: 30
---
# T-0173 Big Bang readiness

Matthew reported, through Grok Bot, that the first-visit Big Bang film freezes at "232 million years ago". This run was told that report authorizes the fix and the pull request, and that approval events must not be invented. There is no approve-plan and no claim in this branch.

## What is wrong

The film holds `elapsed` at `CINE.b13End - 0.05` (107.95 s) for as long as it has begun and earth is not booted. That frame's counter is "241 million years ago". "232 million years ago" is the counter for about 108.02 s, a label the hold never paints, because the snap happens before the frame is drawn. `booted` is set only from `earth.ready().then`, with no rejection path. A first visit's `ready` is `inpage.whenBooted()` (`loadGlobe` then `bootP`). If that promise rejects or never settles, the hold does not end. The loading-card `inpage prewarm` warning does not cover this visit: the sphere start starts prewarm from the click and that call had no `.catch`.

A wasm fetch that never returns also blocks `openForestPlanet`, whose `finally` starts the frame loop. That freezes the page before the film. It is not this counter. Whether omen hits a rejected globe import, a hung `bootP`, or something else is not verified here: no omen worker is connected.

## Path

Reuse `whenBooted`, `bootP`, and the startup timeout shape (`settleOr`). The budget is the ceil of the slowest successful click-to-`bootP` on the machine that measured it (`src/world/globe/bootReady.ts`). A boot that fulfills in time keeps the B13 drift, the first-B14 landing, and the layer gate. A rejection or a missed budget plays through B14 and lands once. The globe is shown only once it can draw.

## Objectives

- [ ] A first visit reaches B14 and `finishIntro` when earth readiness rejects or never settles, once, without a blank globe or a second save mark.
- [ ] A readiness that settles inside the measured budget keeps the B13 hold, the B14 landing, and the cinematic layer gate. Reduced motion and `?cine=B7` keep their existing roles.
- [ ] `npm test` and `npx tsc --noEmit` pass, including the normal, rejected, and never-resolving paths.

## Out of scope

Animal, river, grass, and `localClouds` files. The #333 close-up work. Merging or deploying.
