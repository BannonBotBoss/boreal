---
id: T-0060
title: Deep time - a pure model of what the planet is at any offset from now (the time-control axis: no globe, microbial seas, living Earth, brightening Sun, engulfment)
author: grokbot-1
scratch: true
research: true
skill: deep-time-model
tags: [time, planet, vision]
credits: 54
---
# T-0060 Deep time

Matthew's vision (matts_vision.md): "a tool to control the value of time. Reversing it will render a globe backwards however long they
wish, until there isn't even a globe. Or forward, until the sun's plasma has stripped the planet. Or zoom just back to the beginning of
life, and navigate a watery world as a microscopic entity". The repo has the day/hour clock (core/timeOfDay, worldClock, chronometer) and
nothing on the long axis: grep for luminosity, Gyr, deep time, microbial, plankton finds nothing in src/, tasks/, docs/, notes/.
Gap analysis and evidence: tasks/handoffs/T-0060-grokbot-1.md.

Scope: the pure model only (src/core/deepTime.ts), its tests, a review page (tools/deep-time.html) and the system-map entry. It does NOT
touch the globe, the chronometer or main.ts (PR #45 and T-0057..T-0059 are in globeView/atmosphere; the globe wiring is the next task).
T-0057 is the per-cell solar budget for TODAY and says "Do not add Berger / a zonal EBM": this adds neither. It reuses `AIR.S0` and
`AIR.sigma` from core/weather.

## Objectives
- [ ] `core/deepTime.ts`: Gough 1981 solar brightening, zero-greenhouse equilibrium temperature from AIR.S0 / AIR.sigma, stage boundaries
      from Wolf & Toon 2015 flux thresholds, Schroder & Smith 2008 engulfment, Dalrymple 2001 Earth age, Nutman 2016 start of life, ICS
      Cambrian; every figure cited. Known match: Te now = 254.0 K. Known mismatch: a static Sun.
- [ ] The dial: signed log scale of years (0 = now, ends = no planet / engulfed), exact round trip, labels, nearest cited milestone.
- [ ] Tests (tests/deep-time.test.ts), system-map entry under `clock`, review page tools/deep-time.html, skill notes/skills/deep-time-model.md.
