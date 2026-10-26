---
id: T-0077
title: One clock, and its control in the game
author: grokbot-3
scratch: false
research: false
skill: single-clock
tags: [clock, time, hud, settings]
credits: 40
---

# T-0077 One clock

Matthew in chat, 2026-10-25 17:53 PT: "There seem to be multiple time settings, but there should be only one time control for everything." At 17:55 PT: "the game should have exactly one clock." At 17:57 PT the control "should live in the game itself, as an in-game element the player can adjust while playing, not tucked away in the menu or the settings panel." Direct request (rule 16).

## Already covered (reuse, do not redo)
- `src/core/worldClock.ts` is the clock. Do not add a second integrator.
- The chronometer (`src/ui/chronometer.ts`) is the hour scrub of that clock. Do not add a second dial.
- Deep time (`?deep=`, the planet layer panel) is a geological epoch, not a playback rate.
- Menu container, sizing and scroll stay with `grokbot-3/menu-no-bounce`. This task only removes the Time tab from the layer list.

## Objectives
- [x] One clock and one rate; sky, weather, planet, water, animals, shaders, audio timing, and ground read it
- [x] Remove duplicate rates and controls (ground speed, weather time scale, menu Time layer, settings sliders); map ?hour ?day ?date ?timescale and saved hour/clock
- [x] In-game time HUD (pause, play, rate) for mouse, touch, keyboard, and gamepad
- [x] Tests: one source, one control, static guard
