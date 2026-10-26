---
id: T-0087
title: Snow depth the body can read, using the snow that already falls
author: grokbot-3
scratch: false
research: true
skill: snow-depth
tags: [climate]
credits: 39
---

# T-0087 Snow depth

Step 7 of `notes/design-roadmap.md`. Issue #100. Not claimed.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Snow depth in centimetres is readable where the player stands. New precipitation below 0 °C is snow. At and above 0 °C it is rain. Melt keeps the degree-day factor already in the code.

## Kind

Reuse. The threshold already matches #100 (`src/core/weather.ts` line 274 and `rust/boreal-sim/src/planet_fundamentals/hydrosphere/precipitation.rs` line 77). Depth comes from the snow-water store and `snowDensity` (`weather.ts` line 56, Sturm et al. 2010). Do not add a second snow model. Do not change the 0 °C split.

## Objectives
- [ ] Depth in centimetres is derived from the existing snow-water amount and the cited density
- [ ] A test locks snow below 0 °C and rain at and above 0 °C on both the forest path and the Rust path
- [ ] The depth is readable at the player without a new constant for depth

## Gates

Numbers: density and degree-day factor keep their citations; show the centimetre derivation in the table. Frame: snow on the ground in a below-zero month and bare ground in a warm month, or N/A with the formula checked against a known snow-water value. Evidence: no new snow file.

## Depends on

T-0082, so the forest read and the Rust plane are the same snow. Can run beside T-0085 and T-0086.
