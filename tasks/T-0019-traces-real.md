---
id: T-0019
title: Traces become real: territory scent marks, kill remains and droppings written by agents and smelled through the existing plume
author: grok
scratch: false
research: true
skill: false
tags: [animal, senses, deltas]
credits: 52
---
# T-0019 Traces become real

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Agents write the delta kinds that already exist (scent, carcass, droppings, footprint) as transactions of what they do, and every agent smells them through senses.ts, so trails, marks and remains have causes and consequences.

## Why
Plan step 8. core/deltas.ts already models scent (Peters & Mech 1975), carcass, droppings and footprints with closed-form decay, but only the player writes footprints and deer droppings (main.ts:186-187) and only the wolf HUD smells them (ui/senses.ts:65).

## Files
- core/deltas.ts (writers)
- core/agent.ts (percepts include deltas)
- `core/transactions.ts`
- `main.ts:186-187`
- `ui/senses.ts`

## Size and risk
- Size: M
- Risk: low

## Depends on
- T-0009
- T-0014 (remains)

## What Matthew will see
Wolf scent marks you leave stay on the ring for days; deer avoid a fresh carcass and fresh wolf marks; hares leave droppings near clover.

## Acceptance criteria
- Scent marks, remains and droppings are written by the act that causes them (mark, kill/consume, digest), not timers
- Every agent smells deltas through scentLevel with its own species range
- Delta cap and decay unchanged (rule 9)

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Delta writers as transaction outputs (mark, remains, droppings)
- [ ] Deltas as percepts for every agent
- [ ] Avoid/attract responses as BEHAVIOUR data
- [ ] Tests
