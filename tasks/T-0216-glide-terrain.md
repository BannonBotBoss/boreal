---
id: T-0216
title: The glide shows the ground it is about to land on
author: grokbot-2
scratch: false
research: true
skill: glide-site-frame
tags: [visual]
credits: 26
---
# T-0216 The glide shows the ground it is about to land on

Matthew, direct chat 2026-11-10 20:07 PT: "I told you, no waiting on me". Matthew, direct chat 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues". well, anything i request by direct chat shouldnt need approval (Matthew, 2026-10-22 01:52 PT).

Credits 26 = 10 x 2 objectives x (1 + 0.3 research). Not from scratch: the band camera is `gameToPlanet` in `transition.ts`. T-0215 made that ground the sea. This task is the glide.

D29. "Gliding above the land" was a flat field, pale and then light blue, with no horizon. The band camera kept the home gnomonic after the drop, so the far layer was not the aim. A 400 m glide over 8.487 N, 129.334 W has to be 400 m above that sea.

## Objectives

- [x] The glide camera sits on the aim, one glide height above that surface, and the picture shows that surface.
- [x] A check fails a camera left on the home frame or inside a 5074 m mountain, and passes 400 m above the sea.

## Acceptance

Before: `tasks/evidence/T-0215/before-glide.png` and `after-glide.png` (flat field). After: the same URL and the same aim, with the ocean in frame. Reference: `tasks/evidence/T-0215/ref-pacific-z7.jpg`.
