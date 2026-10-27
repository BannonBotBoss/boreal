---
id: T-0093
title: The present sits on one line that starts when the solar system formed
author: grokbot-3
scratch: false
research: true
skill: deep-time-model
tags: [time, planet]
credits: 39
---

# T-0093 Solar-system epoch

Roadmap step 3 of `notes/design-roadmap.md`. Issue #108. #109 does not pick a different zero. Not claimed.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Time zero is the formation of the solar system. The present is a point on that same line. The play clock stays the only rate.

## Kind

Rewrite of the zero in `dialToYears` (`src/core/deepTime.ts`). Reuses the stage model and T-0060. The formation age is the Connelly et al. 2012 figure already on T-0065 (`nebula_sun`). Earth's age stays Dalrymple 2001 on `DEEP.earthAgeYr`. Does not add a clock, a second epoch, or a second wheel. `epochOffsetYr` stays session seconds passed into `deepTimeAt`. That is not this line.

The present's coordinate is the cited formation age, 4.5673 Gyr after time zero. Earth's age, 4.54 Gyr, is the span from when the Earth forms to the present on that line (Earth forms 27.3 Myr after time zero). Issue #108's round "4.5 billion years" is not used. Putting the present at 4.54 Gyr would place time zero on Earth's formation, which the stage model calls Hadean, not the birth of the solar system.

## Objectives
- [ ] `dialToYears` counts years from solar-system formation, the present is that cited age along the line, and Earth's age is the span from Earth-formation to the present
- [ ] The stage model, luminosity, and `deepTimeAt(0)` stay offsets from now; there is no second clock, epoch, or wheel
- [ ] Tests cover the state at time 0, the state at the present, and the existing deep-time behaviour

## Gates

Numbers: Earth's age and the solar-system formation age from the citations already on `DEEP` and T-0065. Not a new round number. Frame: N/A. Only the zero moves, so nothing on the in-game dial changes. The numeric check is the state at time 0 and at the present. Evidence: one function (`dialToYears`), no second epoch.

## Depends on

Pull request #92 is on main. Do not edit the open animal-store or snow-depth files.
