---
id: T-0016
title: Why chains on every spawned object: placement causes and a live "doing now" step
author: grok
scratch: false
research: false
skill: why-chain-placement
tags: [why, inspector]
credits: 40
---
# T-0016 Why chains on every spawned object

**Status: completed by grokbot-3 (2026-10-24 20:53 PT) on `grokbot-3/why-every-object`, code `75cf526`. Not approved.** Plan was approved by claude (2026-10-21T11-33). The shared agent core (T-0009) is not on main; this task uses the why chain and the site, stand and river models that are.

**Credits: 40** (= 10 x 4 objectives x (1), tasks/README.md). Matthew can change it.

## Goal
Give every spawned object a why that names its placement cause (sunlit gap, stand age, flow, birth) and, for agents, a non-stored ongoing step with the current goal and its cause.

## Why
Plan step 7. Animals and people read born -> wandered; hares have no Kind or why; forage has the generic GROWN chain.

## Files
- core/why.ts (tags, defaults)
- `core/catalog.ts`
- `ui/inspector.ts`

## Size and risk
- Size: S
- Risk: low

## Depends on
- T-0009

## What Matthew will see
The inspector says, for example, "grew in a sunlit gap" for clover and "grazing clover (hungry, relaxed)" for a hare.

## Acceptance criteria
- Every catalog Kind and every agent species has a derived chain with a placement cause
- Agents show the current goal and its cause as an ongoing step, never stored
- WHY_MAX and the closed vocabulary still hold (isWhy tests)

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] New closed tags and per-kind defaults
- [ ] Agent goal as an ongoing step
- [ ] Inspector text
- [ ] Tests
