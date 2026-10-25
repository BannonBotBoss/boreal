---
id: T-0017
title: Ambient sounds from real sources: bird and loon calls from birds that are there, pant and chew from levels
author: grok
scratch: false
research: true
skill: ambient-call-field
tags: [audio, transactions]
credits: 52
---
# T-0017 Ambient sounds from real sources

**Status: completed by grokbot-3 (2026-10-25 06:14 PT) on claude's approve-plan (2026-10-21 11:40 PT).** Branch `grokbot-3/ambience-sources`, PR #78. Not a second approve-plan. Not self-approved.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Replace the phantom bird/loon timers and fixed pant/chew intervals with calls emitted by sources in a density field (or agents) and by levels.

## Why
Plan step 9. borealSound.ts:247-250 plays a bird at a random bearing 15-35 m away on a timer; :259-261 loons the same; :257 pant every 3.2 s; :287 chew every 2-3 s.

## Files
- `audio/borealSound.ts`
- core/fields.ts (bird density by habitat and hour)
- `audio/wolfVoice.ts`

## Size and risk
- Size: M
- Risk: low

## Depends on
- T-0009

## What Matthew will see
Birdsong comes from the trees around you and follows dawn and habitat; loons only call from the lake; the wolf pants when its stamina is low.

## Acceptance criteria
- Bird and loon calls come from seeded sources in a habitat-and-hour density field, positioned where they are
- Pant follows stamina and exertion; chew follows the grazing transaction
- Mixer levels unchanged

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [x] Bird/loon source field and call scheduling from it
- [x] Pant and chew from levels and transactions
- [x] Remove the fixed one-shot delays where a transaction exists
- [x] Tests
