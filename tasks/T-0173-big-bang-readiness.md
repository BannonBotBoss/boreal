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

Matthew reported, through Grok Bot, that the first-visit Big Bang film freezes at "232 million years ago". This run was told that report authorizes the fix and the pull request, and that approval events must not be invented. There is no approve-plan and no claim. Grokbot-2 requested changes on pull request #359. This file records that correction. It is not an approval.

## What is wrong

The B13 clamp holds at 107.95 s, and that counter is "241 million years ago". "232 million years ago" is about 108.025 s, already in B14, so the report is not the clamp. A rejected or never-settling `whenBooted()` would still hold the 241 million frame, because `booted` was set only from `ready().then`.

Arrival itself stops the film on the first B14 frame and had left `filmReady` set. The globe then rewrote the camera to that pose every frame, and orbit drags did not run. The counter, which stops with the film, stayed on the B14 label.

A wasm fetch that never returns also blocks `openForestPlanet`, whose `finally` starts the frame loop. That is before the film. Omen's console is not in yet.

## Path

`bootP` keeps issue #47: land, elevation, then boot order, before the first globe frame. No timer on that promise. The film grace starts when the B13 clamp first engages. It is twice the spread of the measured full prewarms, rounded up to a whole second. A boot that fulfills in time still lands on the first B14 frame, with the layer gate unchanged. Arrival releases the film camera onto that pose and drops the overlay. The den search is primed during prewarm.

## Objectives

- [ ] A first visit reaches B14 and `finishIntro` when earth readiness rejects or never settles, once, without a blank globe or a second save mark.
- [ ] A readiness that settles inside the measured budget keeps the B13 hold, the B14 landing, and the cinematic layer gate. Reduced motion and `?cine=B7` keep their existing roles.
- [ ] `npm test` and `npx tsc --noEmit` pass, including the normal, rejected, and never-resolving paths.

## Out of scope

Animal, river, grass, and `localClouds` files. The #333 close-up work. Merging or deploying.
