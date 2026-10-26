---
id: T-0077
title: Keep the pad menu one centered size when the layer changes
author: grokbot-3
scratch: false
research: false
skill: fixed-menu-frame
tags: [ui, menu, gamepad]
credits: 40
---

# T-0077 Menu stays put

Matthew in chat, 2026-10-25 17:51 PT: the in-game pad menu jumps vertically when LB/RB (keyboard `[` / `]`) cycle Camera, Time, Badges, Gallery and Settings. At 17:52 PT he said to keep the vertical centering and make the centered box the same size. At 17:53 PT he specified one box sized to the tallest of those five, capped at the screen, no visible scrollbar, large arrows, and hold-to-repeat with edge auto-scroll. Direct request (rule 16). He also said to open a PR and not to merge or approve it.

## Cause
`PAD_CSS` on main `e7b9ab7` (`src/ui/padMenu.ts` line 101) is `top:50%` plus `translate(-50%,-50%)` with `max-height:86vh` and no fixed height. The box is as tall as its content, so the centered top moves. At 1280×720 the measured tops were camera 220.0, time 188.6, badges 32.4, gallery 190.7, settings 130.0 (`tasks/evidence/T-0077/before-720.json`).

## Objectives
- [x] One centered box, the tallest of camera, time, badges, gallery and settings, capped at the screen, so the top, header and tabs stay put
- [x] Overflow scrolls under the header with no visible scrollbar; large arrows show only when more content is that way, from mouse, keyboard and controller, without taking LB/RB
- [x] Holding up or down repeats after a short delay then at a steady rate, and the selected row stays fully visible, including an automatic scroll at the top and bottom edges
- [x] Tests cover the shared frame, the arrows, hold-to-repeat and edge auto-scroll both ways
