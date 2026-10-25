---
id: T-0014
title: Hunting II: pin with the front paws, grasp in the jaws, one squeal, limp carry, eat for nutrients or release as a temporary friend
author: grok
scratch: true
research: true
skill: hunt-pin-carry
tags: [animal, behaviour, wolf, hunting, transactions]
credits: 108
---
# T-0014 Hunting II

**Status: completed by grokbot-3 (2026-10-25 03:32 PT).** Claim sits on agy's approve-plan (2026-10-21 11:45 PT). Not a second approve-plan. The finished-work approve is a rule 16 relay. Branch `grokbot-3/hunt-hold`, stacked on `grokbot-3/hunt-lock` (PR #75, T-0013). Issue #10.

**Credits: 108** (= 10 x 6 objectives x (1 + 0.5 scratch + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
On contact the wolf pins the prey with its front paws and grasps it in its jaws; the prey squeals once and goes limp; Matthew can hold it, eat it (A) for nutrients, or release it (B), after which it treats the wolf as a friend for a few minutes until its memory resets.

## Why
Plan step 6. Today a caught hare just vanishes (hare.ts:68-69). Hunting design saved 2026-10-21; defaults eat = A, release = B, friendship about 3 min.

## Files
- core/transactions.ts (wolf|hare rows: pin, bite, hold, consume, release)
- core/events.ts (records, temporary relationship with expiry)
- render/playerWolf.ts (pin/carry pose)
- audio/borealSound.ts (squeal)
- core/deltas.ts (remains)
- `tests/hunt.test.ts`

## Size and risk
- Size: L
- Risk: medium-high: rig pose and carry

## Depends on
- T-0013

## What Matthew will see
The wolf lands its front paws on the hare, grabs it, the hare squeals once and hangs limp in its jaws; A eats it (energy goes up), B lets it go and it stays calm near the wolf for a few minutes.

## Acceptance criteria
- Every step is a transaction row (contact -> pin -> bite -> hold); no timers beyond the contact and the levels
- Consume moves prey mass into wolf energy by a cited ratio, leaves remains as a delta
- Release writes a friend memory that decays (closed form) and suppresses the prey's flight while it lasts
- Eat and release actions rebindable

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [x] Pin and bite transaction rows on wolf|prey contact
- [x] Hold: prey limp and carried in the jaws (pose from the rig)
- [x] Consume: nutrients to energy, remains delta
- [x] Release and temporary friendship memory with decay
- [x] Squeal and sounds from the transaction rows
- [x] Tests for each transaction and the memory reset
