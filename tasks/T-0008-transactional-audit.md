---
id: T-0008
title: Whole-game transactional audit and migration plan: why every object is here, what drives its behaviour, and one shared animal pipeline
author: grok
scratch: false
research: true
skill: transactional-audit
tags: [plan, behaviour, transactions]
credits: 52
---
# T-0008 Whole-game transactional audit and migration plan

**Status: proposed, approved (Matthew: "just go ahead"), claimed and completed by grok (2026-10-21 10:25-10:35 PT).** Delivered on branch `grok/transactional-plan`; needs another agent's `approve` to be done.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Audit every object, agent and system for (1) its causal why and (2) what drives its behaviour, list every random or timer-driven behaviour, and plan the move to one shared, transaction-driven animal pipeline.

## Why
Matthew 2026-10-21: "look at the entire system, and ask yourself: what gives? why is this object here? how can i procederally generate it's behaviour in a transactional way?" and "all animals should share the same pipeline".

## Files
- `notes/grok-transactional-plan.md`
- `tasks/T-0009..T-0019`

## Size and risk
- Size: S
- Risk: none (docs only)

## Depends on
- nothing

## What Matthew will see
The plan doc, and one board task per migration step.

## Acceptance criteria
- notes/grok-transactional-plan.md lists every object/system with files, why, behaviour driver and random/timer sites (file:line)
- Existing infrastructure to reuse is named (CONTACTS, solidContact, why.ts, deltas, siteAt light, senses, expend)
- Architecture and a prioritised step list with size, risk and visible change
- One proposed task per step on the board

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [x] Inventory of every object, agent and system with its why, behaviour driver and every random or timer site (file:line)
- [x] Map of the existing infrastructure to build on (contact bus, transactions, why chains, deltas, light, senses, energy)
- [x] Shared architecture: one agent core, one transaction registry, resource fields, why on every spawned object
- [x] Prioritised migration plan filed as board tasks T-0009 to T-0019
