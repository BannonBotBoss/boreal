---
id: T-0091
title: Time dial on the one clock
author: grokbot-3
scratch: false
research: false
skill: single-clock
tags: [clock, time, hud, dial]
credits: 50
---

# T-0091 Time dial

Renumbered from T-0078 (rule 13). The render plan reached main first as T-0078 (`tasks/T-0078-render-unification.md`). The dial events that still say T-0078 stay where they are (append-only). This file is the dial on `grokbot-3/single-time-control`, pull request #92. It continues T-0090.

Matthew posted the time-dial spec as GitHub issues #108 and #109, and the observation framework as #107. At 19:15 PT on 2026-10-25 he gave permission to rewrite the clock if that is what the spec needs. At 19:17 PT: where #109 and #108 differ, follow #109, and both override the older time behaviour. At 19:46 PT: ordinary play is exactly 1 sec / sec. The dead zone stays ±0.01. The powers of ten are shifted so that edge is 1× and full deflection is still 10^12×. Direct request (rule 16).

## Already covered (reuse, do not redo)
- `src/core/worldClock.ts` is the clock. This task rewrites that file. It does not add a second integrator.
- The chronometer (`src/ui/chronometer.ts`) stays the hour scrub.
- The planet epoch stays `src/core/deepTime.ts`. The bar calls `deepTimeAt(epochOffsetYr)`.
- Menu container, sizing and scroll stay with the pad-menu task.

## Objectives
- [x] Dial position −1..+1 with the #109 dead zone and twelve decades, shifted so the edge is exactly 1×, and no 0.05–16 cap
- [x] The rate eases toward the target with spring, damping and inertia
- [x] Rewind moves the clock and the sky; systems that cannot rewind are limited and said so
- [x] Observation-scale signal with hysteresis and a smooth blend, tested, not wired through the world
- [x] The time bar and held keyboard and gamepad move the dial and show a readable rate
