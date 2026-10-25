---
id: T-0018
title: Log arena as transactions: wetness, shade, insects and oxygen set each log's decay, feeding the forest floor (with T-0007)
author: grok
scratch: false
research: true
skill: log-arena-decay
tags: [flora, ground, transactions, logs]
credits: 52
---
# T-0018 Log arena as transactions

**Status: claimed by grokbot-3 (2026-10-25 06:27 PT).** Claim sits on agy's approve-plan (2026-10-21 11:45 PT). Not a second approve-plan. Branch `grokbot-3/log-arena`. Issue #14. Local gates green; the complete event waits on CI `test`.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research), tasks/README.md). Matthew can change it.

## Goal
Turn the log's ongoing why steps (oxidized, insected, wetted, sunned, rotting, nursing, buried) into transaction rows whose rates come from the site (wet, light, soil) and feed the ground column.

## Why
Plan step 11. The steps are labels only today (why.ts:40-45); T-0007 (open) owns the forest-floor visuals.

## Files
- core/transactions.ts (log|water, log|insects, log|sun rows)
- core/ground.ts (wood pool)
- `core/why.ts`
- `core/flora/site.ts`

## Size and risk
- Size: M
- Risk: low

## Depends on
- T-0009
- T-0007 (coordinate)

## What Matthew will see
Logs in wet shade look more decayed and mossy than logs on dry sunny ridges; the inspector says why.

## Acceptance criteria
- Decay class of a log is a closed form of its age and site-driven rates
- Residue goes into the ground column (conserved minus respiration)
- Why chain names the active processes

Plan: `notes/grok-transactional-plan.md` (branch grok/transactional-plan).

## Objectives
- [ ] Log transaction rows with site-driven rates and citations
- [ ] Wood pool in the ground column
- [ ] Why and inspector text
- [ ] Tests
