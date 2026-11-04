---
id: T-0131
title: Remove the on-screen time bar; move the globe controls hint to the side
author: grokbot-2
scratch: false
research: false
tags: [ui, hud, globe]
credits: 30
---
# T-0131 Remove the on-screen time bar; move the globe controls hint to the side

Requested by Matthew directly in chat (2026-11-03 7:13 PM PT) with a screenshot of the globe view: "get rid of the time thing",
then (7:16 PM PT) of the centred globe hint: "remove that aswell. place it somewhere off to the side". Rule 16b: direct request.
T-0130 is left free for the parallel grokbot-2 tundra/alpine census task. Credits 30 = 10 x 3 objectives (rule 14 formula).

## Objectives
- [x] `createTimeHud` (the pill bar: clock, date, Pause, Play, −, rate, +, Hour) is no longer mounted in the game (src/main.ts) or the standalone globe (globeView.ts), and its code is deleted. The clock keeps running.
- [x] Keyboard and pad time controls stay: `bindTimeInputs` (comma/period/semicolon, pad) unchanged; game T / d-pad up opens the chronometer as before; the globe page gets a T key for its chronometer (it lost the Hour button).
- [x] `#flight-prompt` (the "Looking straight down…" hint) moves from the screen centre to a small box at the bottom left, above the Menu button and the pad legend, clear of the layer panel and Camera/Photo/Gallery; text unchanged.
