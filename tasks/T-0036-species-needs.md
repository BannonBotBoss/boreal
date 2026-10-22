---
id: T-0036
title: Species needs + behaviour template (water, energy, rest), thought bubbles, stamina 10 s sprint / 30 s run
author: grok
scratch: true
research: true
skill: species-needs-template
tags: [gameplay, animals, ui, needs]
credits: 90
---
# T-0036 Species needs template, hydration, thought bubbles and stamina

Matthew, 2026-10-22 00:4x PT: "the wolf should be able to run at least 10 seconds in sprint, and 30 in run before needing a
breather. it also needs a hydration counter, something that is reduced according to real world figures. when the hydration
level dips below 30 %, thought bubbles should float up from the head, as semi transparent icons, fading to 0 after a second
or two. this should repeat every 10 seconds. when the levels approach critical, the thoughts should apear as an alert that
pulses. with a fasster frequency." Then (relayed by Grok Bot): "with all needs"; any creature can be embodied later, so it
lives in the shared animal pipeline; "like a template"; the template carries the behaviour model too.
Branch `grok/wolf-hydration` (worktree C:\dev\boreal-grok-hydration, from main a436a9d).

## Objectives
- [x] 1. Stamina from the species template: sprint >= 10 s and run >= 30 s from full before the breather (tests)
- [x] 2. One typed species needs + behaviour template (sourced slots); wolf and snowshoe hare as instances; copy-me template
- [x] 3. One generic needs engine (water, Energy = the existing stat, rest) at sourced rates on the game clock; drink at water; saved; HUD
- [x] 4. Thought bubbles per need (<30 % every 10 s, fade 1.75 s; <=10 % pulsing alert every 3 s; staggered/stacked); third and first person
- [x] 5. Behaviour model drives the autonomous (NPC) wolf: thirst -> water + drink, tired -> bed down, activity pattern; tests, recording, number table, skill
