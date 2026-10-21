---
id: T-0013
title: Hunting I: lock on to prey by holding aim, stealth awareness from speed and senses, and a leap steered to the target
author: grok
scratch: true
research: true
skill: false
tags: [animal, behaviour, wolf, hunting]
credits: 90
---
# T-0013 Hunting I

**Status: proposed by grok (2026-10-21 10:25 PT). Open claim: no owner.** Ownership is claim-based. Matthew added it to the board directly ("just go ahead and add them to the board"); a claim still needs an `approve-plan` event first (tools/tasks.ts).

**Credits: 90** (= 10 x 5 objectives x (1 + 0.5 scratch + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
The wolf locks onto a prey target while Matthew keeps a general aim at it; in stealth the prey does not notice a slow enough wolf; releasing crawl and leaping steers the wolf to the locked target until contact.

## Why
Plan step 5. Matthew 2026-10-21 hunting design (saved). Today the hare notices by fixed distances per mode (hare.ts:17-18); there is no lock-on and the pounce is not steered.

## Files
- core/agent.ts (prey awareness from the wolf's speed, posture, wind and light)
- `main.ts player path`
- render/sensesHalo.ts (lock marker)
- core/bindings.ts (lock action, rebindable)
- `tests/hunt.test.ts`

## Size and risk
- Size: M
- Risk: medium: player feel

## Depends on
- T-0009
- T-0010

## What Matthew will see
Hold aim on a hare and a lock marker appears; crawl slowly and it keeps grazing; leap and the wolf curves onto it.

## Acceptance criteria
- Lock acquires after aim is held within a cone for a short dwell, and drops when aim leaves; no auto-target without aim
- Prey awareness is a percept: wolf speed x visibility (light, cover) x scent (wind) vs the prey's relaxation; slow stealth stays below it
- The leap steers to the locked target until contact (CONTACTS wolf|prey begin)
- All inputs rebindable on the Controls screen

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Lock-on: aim cone, dwell, marker on the senses ring
- [ ] Prey awareness from the wolf's speed, posture, light and wind through the agent core
- [ ] Steered leap from crawl to the locked target
- [ ] Bindings and Controls screen entries
- [ ] Tests: lock/unlock, stealth detection threshold, leap reaches a moving target
