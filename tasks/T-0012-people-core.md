---
id: T-0012
title: People (visitors) on the shared agent core: travel between water, berries and rest, and notice the wolf
author: grok
scratch: false
research: true
skill: false
tags: [people, behaviour]
credits: 52
---
# T-0012 People (visitors) on the shared agent core

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Give visitors behaviour through the same agent core and a person BEHAVIOUR row, replacing the sine sway.

## Why
Plan step 10. People are static with a sine sway (render/buildScene.ts:270); their why is born -> wandered.

## Files
- core/species.ts (person row)
- `core/catalog.ts`
- `render/buildScene.ts:121-129,268-270`
- `core/why.ts`

## Size and risk
- Size: M
- Risk: low

## Depends on
- T-0009

## What Matthew will see
Visitors walk to water and berry patches, sit to rest, and turn to watch the wolf when they notice it; friends stay relaxed near it.

## Acceptance criteria
- Movement and posture follow needs (thirst, hunger, rest) and percepts; no sine sway
- The friend relationship changes how a person reacts (relaxed, approaches) through the same memory model as animals
- Why/inspector shows the current goal

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Person BEHAVIOUR row and the live-LOD path stepped by the agent core
- [ ] Needs and targets from the resource fields (water, forage)
- [ ] Relationship memory read from records
- [ ] Tests and inspector text
