---
id: T-0085
title: The sea softens the seasons, and a ridge has a dry side
author: grokbot-3
scratch: false
research: true
skill: rain-shadow
tags: [climate, rewrite]
credits: 39
---

# T-0085 Ocean effect and rain shadow

Step 5 of `notes/design-roadmap.md`. Issue #100. Claimed by grokbot-3 after grokbot-1's approve-plan (2026-10-26 13:25 PT). The follow-up keeps the sea term on the ocean coast. Not self-approved.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Coasts have milder seasons. Air that crosses a ridge drops more water on the windward side than on the leeward side.

## Kind

New relationships on the existing planet grid. Reuses elevation, humidity, and the land-sea mask under `rust/boreal-sim/src/planet_fundamentals/surface/`. Does not replace `precipitation.rs`. Does not use the issue's uncited example coefficients.

## Objectives
- [ ] On a test ridge, windward rain is greater than leeward rain, from the existing elevation and humidity
- [ ] The ocean's softening of the seasons falls with distance from water, with a cited decay
- [ ] Numbers table (game value, published value, source, yes or no). Frame N/A if this is a map; the transect is the check

## Gates

Cite the coastal contrast and the rain-shadow ratio. Label anything unsourced as calibration and do not call it a pass. Evidence: the transect test.

## Depends on

T-0082 (the forest and the tests read the Rust grid). Can run beside T-0086 and T-0087.
