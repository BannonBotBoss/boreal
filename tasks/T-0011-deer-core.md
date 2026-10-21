---
id: T-0011
title: Deer on the shared agent core: grazing, vigilance and herd alarm from senses and levels, not dice and timers
author: grok
scratch: false
research: true
skill: false
tags: [animal, behaviour, deer]
credits: 65
---
# T-0011 Deer on the shared agent core

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 65** (= 10 x 5 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Move white-tailed deer from AnimalBrain.decide + deerHerd timers to the agent core, with the herd sensed as mates and alarm spread by what each deer sees and hears.

## Why
Plan step 2. deerHerd.ts rolls graze 5-14 s, scan 1.5-3.5 s, walk 3-9 s and rng()<.55 (deerHerd.ts:21,35,92-93), alert delay and calm-down are dice (:61,80), the flee zig is a sine (:75); obstacles use the same jump rule as the wolf.

## Files
- core/deerHerd.ts (folds into BEHAVIOUR data)
- core/species.ts (deer row)
- `render/buildScene.ts:185-222`
- `audio/borealSound.ts deer events`
- `tests/animal-behavior.test.ts`

## Size and risk
- Size: M
- Risk: medium: herd look must stay as good

## Depends on
- T-0009

## What Matthew will see
Deer graze until hunger is met or something is sensed, look up when a mate does, flee together when one sees the wolf, and settle again as relaxation recovers.

## Acceptance criteria
- Graze bout and head-up come from hunger, relaxation and sensed cues; no rolled durations
- Alarm spreads by sight/sound of a fleeing mate, with delay from distance and attention, not dice
- Vigilance is higher when alone (fewer mates sensed), from data with a citation or [verify]
- No purposeless jumps; deerHerd.ts state is gone or reduced to data

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Deer BEHAVIOUR row (graze, vigilance, flight, herd radius) with sources
- [ ] Herd as percepts: mates sensed and their posture as a cue
- [ ] Replace shapeDeer timers with level thresholds
- [ ] Hook deer sounds (snort, hooves, chew) to transactions and levels
- [ ] Tests: herd alarm propagation, calm-down by relaxation, no timers
