---
id: T-0007
title: Forest floor as layered fallen wood - visual litter and buried wood built from many trunk cycles
author: grok
scratch: true
research: false
skill: false
---
# T-0007 Forest floor as layered fallen wood

**Status: proposed by grok (2026-10-19 07:27 PT). Open claim: no owner.** Matthew: "whoever owns the ground is whoever
wants to take on those tasks." Any agent may claim it after another agent's `approve-plan`; the claimant writes the full
plan (files, tests, budget) in its handoff before any code. Matthew merges.

## What Matthew asked (2026-10-19, omen)
The fallen log is an arena of ongoing transactions (insects, water, oxygen, sunlight, gravity holding it). One side rots,
the other collects debris and lets other plants grow. This fall -> seat -> decay -> arena cycle happens many times over,
"so the ground is made of tree trunks": the forest floor is accumulated fallen wood.

## Where it stands (T-0006, `grok/T-0006-solid-contact`)
- Provenance only: `core/why.ts` gives the log a 23-step chain ending in `buried` ("becoming forest floor") and the ground
  a derived chain `GROUND_WHY` = weathered -> accumulated ("built up from many cycles of fallen trunks"), shown by the
  inspector on terrain. No terrain, ground-model or flora change.
- Contact signal: `core/contactBus.ts` `CONTACTS` (log|ground begins at chunk build, source `chunk-build:log`), with
  optional seating inputs (trunkDensity, earthDensity, sinkFraction).

## Sketch (for the claimant to turn into a plan)
- **Ground model:** `core/ground.ts` already has organic layers (fresh litter, fragmented, duff, humus, SOM) with decay
  rates and bulk densities. Add coarse woody debris / buried wood as a layer (or a pool) fed by log decay, so the column
  under and around old logs shows wood-derived duff. Seeded and derived, not stored per cell unless a delta changes it.
- **Visual litter:** low-cost surface cues on the forest floor (scattered bark and branch litter, mossy hummocks where old
  trunks were), from the same seeded positions, within the tier budgets (no new programs on Low and below).
- **Nurse logs (with flora owners):** seedlings / moss favoured on the debris side of resting logs; reads
  `CONTACTS.touching()` and the why chain instead of re-detecting contact.
- **Why:** if a buried-wood layer exists at a point, the ground's why there can name it (still closed steps).

## Constraints
- Do not seat, sink or tilt logs (T-0005 owns seating). Do not move T-0006's contact call site.
- No new simulation beyond the existing ground column and deltas; deterministic from seeds.
- Budgets: no per-frame work when nothing changes; smoke-tiers clean on every tier.

## Open questions for Matthew
1. Visual first (litter you can see) or ground-model first (layers in the inspector)?
2. Should nurse-log seedlings be in scope, or a separate flora task?
