---
id: T-0009
title: Shared agent core, transaction registry and resource fields, with the snowshoe hare and sunlit clover as the first species
author: grok
scratch: true
research: true
skill: false
tags: [animal, behaviour, transactions, hare, clover]
credits: 108
---
# T-0009 Shared agent core, transaction registry and resource fields, with the snowshoe hare and sunlit clover as the first species

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 108** (= 10 x 6 objectives x (1 + 0.5 scratch + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Land ONE agent pipeline for every animal (senses + levels -> goal -> action -> contact transactions), one transaction registry keyed by kind pair, and resource fields with sunlight-driven regrowth. The hare is the first species and its old script is retired.

## Why
Plan steps 0 and 3 (notes/grok-transactional-plan.md). hare.ts is a standalone timer/dice script (hare.ts:51,73-85) outside the species system (PROJECT-RULES rule 3). Matthew's hare spec (2026-10-21): graze clover in sunlit patches, head up on crossing its awareness radius, flight 3 s / pause / relax, energy 100, rest -1/8 /s, flight x8, stamina 8 s, 100 clover units = 1 energy, 100 units per 3 s, patch 0->100 in 15 min from sunlight; timings come from its senses, energy and relaxation, not clocks.

## Files
- core/agent.ts (new)
- core/transactions.ts (new)
- core/fields.ts (new)
- core/species.ts (BEHAVIOUR rows)
- core/deltas.ts (grazed kind)
- `core/stateFields.ts`
- animals/hare.ts (retired into data)
- `render/buildScene.ts`
- `tests/agent.test.ts`

## Size and risk
- Size: L
- Risk: medium: new shared core that later tasks depend on

## Depends on
- T-0008
- grok/rabbit-clover (build there; this task files it)

## What Matthew will see
Hares grazing head-down in clover in sunlit gaps, lifting their heads when the wolf comes close, bolting if it moves, tiring; clover patches thin and regrow.

## Acceptance criteria
- No Math.random, no fixed behaviour timers in the hare path: every state change names its cause (a percept or a level threshold)
- Transactions are data rows keyed kindA|kindB and run from CONTACTS edges; sun|clover and hare|clover rows exist
- Clover units are a closed form of sun hours since the last grazed delta (catch-up exact, nothing per frame far away)
- Hare levels (energy, stamina, relaxation) are tagged in stateFields; npm test passes; snapshot/rewind works
- Debug readout of a hare's levels and current goal

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Agent core core/agent.ts: percepts, levels, goal pick, action plan; AnimalBrain keeps locomotion only
- [ ] Transaction registry core/transactions.ts keyed by kind pair, subscribed to CONTACTS, data-row effects
- [ ] Resource fields core/fields.ts: sunlight on the ground from siteAt light and solar shortwave, clover units with closed-form regrowth via deltas
- [ ] Hare BEHAVIOUR row in core/species.ts with Matthew's numbers, relaxation level and stamina-gated flight
- [ ] Retire animals/hare.ts behaviour (model and spawn stay until the rig pipeline takes it)
- [ ] Tests: graze/head-up/flight/relax driven by percepts and levels, clover depletion and regrowth, no timers
