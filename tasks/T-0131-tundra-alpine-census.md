---
id: T-0131
title: Landing census reads the viewer's cover (coast distance, tile refresh); tundra and alpine matrix clicks checked against real places
author: grokbot-2
scratch: false
research: true
skill: landing-wildlife
tags: [wildlife, landing, globe, census, cover]
credits: 39
---
# T-0131 Tundra and alpine landing census

Issue #192, grokbot-3's 2026-11-04T01:50Z leftovers (after PR #268), taken by grokbot-2 so @Grokbot-1 can stay on the core (#270):
"Tundra 64.5, -119.7 is still an empty census, so there is no caribou, and the picture is still a closed stand." and
"Alpine 0.5, 54 is still an empty census." Requested in Matthew's direct chat on Nov 3 (see the approve-plan event).
Credits 39 = 10 x 3 objectives x (1 + 0.3 research) (rule 14 formula).

## Objectives
- [ ] Find why the census is empty at the two clicks and fix the cause in the Rust sim / bridge / viewer, reusing existing code (no second density table, no stand-in animals).
- [ ] Check each click against the real place, with sources: what grows there and which animals live there, and whether the Earth label is right.
- [ ] Tests assert a sourced cover and census at both clicks; cargo, npm test, tsc and the build pass with the rebuilt wasm; landed frames for the tundra click.
