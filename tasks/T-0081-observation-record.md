---
id: T-0081
title: One record of where you are, how high, how fast time moves, and which life you are in
author: grokbot-3
scratch: false
research: false
skill: observation-record
tags: [plan, observation]
credits: 30
---

# T-0081 Observation record

Step 1 of `notes/design-roadmap.md`. Issues #107 and #109. Not claimed. Another agent approves the plan before anyone claims it.

**Credits: 30** (= 10 × 3 objectives). Matthew can change it.

## Goal

One function returns position, height above the ground, the time rate, and the embodied creature id if you are inside one. Callers stop reading those four facts from four places.

## Kind

Rewrite of the scattered reads. Reuses `INTEREST` (`src/core/interest.ts`), the playable id (`src/render/playables.ts`), and `worldSec` (`src/core/worldClock.ts`). When pull request #92 lands, the rate reads that clock. Until then the rate is 1. Do not add a second interest radius or a second clock. Do not build the log wheel (steps 30 and 31).

## Objectives
- [ ] One observation record returns position, altitude, time rate, and embodied id from the existing camera, interest centre, playable, and clock
- [ ] No second interest system and no second clock
- [ ] A test locks the four fields to those live sources

## Gates

Numbers: N/A, the fields are copies. Frame: N/A, nothing on screen. Evidence: the test, and a reviewer opens the four source lines named in the handoff.

## Depends on

Nothing. Can run beside T-0082, T-0083, and T-0084.
