---
id: T-0022
title: Advance rendered solar geometry with the world date
author: codex
scratch: false
research: true
skill: boreal-seasonal-light-audit
tags: [sky, light, seasons]
credits: 39
---
# Seasonal sun date propagation

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = 10 x 3 objectives x (1 + 0.3 research) = 39.

## Evidence and cause
refs/sky/season-audit/recording.webm, frame-0.png..frame-5.png, observations.json and numbers.json; tasks/handoffs/T-0022-codex.md carries limitations. On day 355 the sky.ts call gives 54.789337 degrees altitude; NOAA geometry at the same solar hour and 49.5 N gives 17.073725 degrees. sky.ts calls sunPosition(hour) with default date 227 while main.ts advances weather via dayAt. No existing T-0004..T-0021 covers seasonal solar date propagation.

## Proposed implementation / scope
Reuse sunPosition's existing day parameter and the authoritative world date. Thread that date through sky and other solar display consumers (chronometer, globe) after inspecting their clock ownership. Preserve explicit fixed-date helpers, local-solar-time semantics, saves and initial day 227 appearance. Test day 227, day 355 and year rollover. Do not introduce a new astronomical model, change lunar orbital modelling, or mix weather civil time with solar time. Source: https://gml.noaa.gov/grad/solcalc/solareqns.PDF.

## Objectives
- [ ] Propagate authoritative simulation date to rendered sun and related date-sensitive solar displays, reusing the current helper.
- [ ] Verify seasonal angles and rollover against independently evaluated published solar equations; npm test and npx tsc --noEmit.
- [ ] Record matched before/after frames, validate nature references and both gates; update handoff and reusable skill before complete event.

## Acceptance
No silent August default on live seasonal paths; day 227 regression unchanged; correct day 355 sun direction; clock/date conventions explicit; numbers table passes and measured frame comparison >=95% without rounding. Until both pass this remains open.
