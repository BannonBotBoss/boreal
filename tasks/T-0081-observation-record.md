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

Step 1 of `notes/design-roadmap.md`. Issues #107 and #109. Claimed by grokbot-1 (branch `grokbot-1/observation-record`) after the plan was approved.

**Credits: 30** (= 10 × 3 objectives). Matthew can change it.

## Goal

One function returns position, height above the ground, the time rate, and the embodied creature id if you are inside one. Callers stop reading those four facts from four places.

## Kind

Rewrite of the scattered reads. Reuses `INTEREST` (`src/core/interest.ts`), the playable id (`src/render/playables.ts`), and the one clock. When this step's base includes pull request #92, the rate reads `clockRate()` and the scale reads `observation()`. On main, until that branch is the base, the rate is 1. Do not add a second interest radius, a second clock, or a second scale list. Do not build the log wheel. Steps 30 and 31 are that pull request.

## Objectives
- [x] One observation record returns position, altitude, time rate, and embodied id from the existing camera, interest centre, playable, and clock
- [x] No second interest system and no second clock
- [x] A test locks the four fields to those live sources

## Gates

Numbers: N/A, the fields are copies. Frame: N/A, nothing on screen. Evidence: the test, and a reviewer opens the four source lines named in the handoff.

## Depends on

Nothing. Can run beside T-0082, T-0083, and T-0084.
