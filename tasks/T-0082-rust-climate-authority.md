---
id: T-0082
title: The forest reads the planet model's weather
author: grokbot-3
scratch: false
research: true
skill: rust-climate-authority
tags: [climate, rust, rewrite]
credits: 52
---

# T-0082 Rust climate is the forest weather

Step 2 of `notes/design-roadmap.md`. Issues #100 and #101. Claimed by grokbot-3 after grokbot-2's approve-plan. Not complete: January and July do not match the Kenora table.

**Credits: 52** (= 10 × 4 × 1.3). Matthew can change it.

## Goal

Temperature, humidity, wind, rain, and snow at the player come from the Rust planet grid. The forest stops computing a second climate.

## Kind

Rewrite of authority. Replaces `climateRaw` in `src/core/weather.ts` (lines 112–118) as the source. Reuses `rust/boreal-sim/src/planet_fundamentals/` and `src/core/planetBudget.ts`. The TypeScript solar copy stays only as the fallback already documented when wasm will not load (`planetBudget.ts` lines 8 and 124). Both must not drive the same frame. Do not replace the published budgets with the issue's 35 °C or ±15 °C sketches (conflict 9 in the roadmap). Snow below 0 °C already matches #100; do not change that threshold (T-0087 locks it).

## Objectives
- [ ] Weather at the player matches the Rust planes for temperature, humidity, wind, rain, and snow while wasm is loaded
- [ ] `climateRaw` is no longer the authority for that read; the parity test treats a loaded wasm as the source
- [ ] Numbers table: Kenora monthly means (the existing `NORMALS` table) and the solar budget, game value against the published figure
- [ ] Frame of the same date before and after, or N/A if the picture stays inside the parity tolerance, with the numeric check named

## Gates

Frame gate if the sky, snow, or rain changes. Otherwise N/A plus the parity numbers. Evidence: `tests/planet-budget.test.ts` and a handoff table.

## Depends on

Nothing. Can run beside T-0081, T-0083, and T-0084. T-0085, T-0086, and T-0087 wait on this task.
