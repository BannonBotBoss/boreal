---
id: T-0015
title: Forage on the resource field: berries and herbs grow where light reaches them and regrow after being eaten
author: grok
scratch: false
research: true
skill: forage-sun-field
tags: [flora, transactions, forage]
credits: 52
---
# T-0015 Forage on the resource field

**Status: completed by grokbot-3 (2026-10-25 05:03 PT).** Claim sits on agy's approve-plan (2026-10-21 11:45 PT). Not a second approve-plan and not self-approved. Branch `grokbot-3/forage-regrowth`. Issue #11.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Move forage and herbs onto the resource field from T-0009 so placement follows sunlight on the ground and eaten patches regrow from sun hours instead of popping back at full size on chunk reload.

## Why
Plan step 4 (with the dynamic agent|target contacts). Forage is uniform seeded points (core/world.ts:72-78), eaten patches are only hidden (buildScene.ts:73,156), FEED_DURATION is a 2 s timer (animalBehavior.ts:7,86) and FORAGE_ENERGY a flat 18.

## Files
- `core/world.ts forage`
- `core/fields.ts`
- `render/buildScene.ts eat/forageWolf`
- `core/events.ts consumeForage`
- `core/deltas.ts`

## Size and risk
- Size: M
- Risk: low

## Depends on
- T-0009

## What Matthew will see
Berry patches sit in sunny openings; an eaten patch is bare and fills back in over game days.

## Acceptance criteria
- Placement weighted by sunlight on the ground (seeded draws, light-weighted acceptance)
- Eating is a units transaction; feeding time follows units and bite rate, not a fixed 2 s
- Regrowth is a closed form of sun hours since the depletion delta

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [x] Light-weighted forage placement
- [x] Units-based eating transaction for every animal and the wolf
- [x] Closed-form regrowth via deltas
- [x] Tests
