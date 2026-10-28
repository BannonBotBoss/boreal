---
id: T-0103
title: Weather moves, and the climate is what it relaxes toward
author: grokbot-3
scratch: false
research: true
skill: weather-cell-relaxes
tags: [climate, weather]
credits: 52
---

# T-0103 Weather relaxes toward the planet climate

Step 4 of `notes/design-roadmap.md`. Issue #100 (weather cells, clouds, rain). Not claimed.

**Credits: 52** (= 10 × 4 × 1.3). Matthew can change it.

## Goal

The air around the player is a weather cell (temperature, pressure, humidity, wind) that moves. Left alone, it relaxes toward the planet climate from step 2 (T-0082), not toward the private `climateRaw` formula.

## Kind

Rewrite of the driver only. Reuses `initWeather`, `updateWeather`, Kessler rain, the Manabe bucket, and the degree-day melt. Does not add a second column, a second snow model, or a new relaxation time. The snow threshold stays below 0 °C (T-0087).

## Objectives
- [ ] The near grid's relaxation target is the Rust planet climate while that grid is bound
- [ ] `climateRaw` is not called from the near grid on that path
- [ ] The cited lapse, Kessler, and Manabe constants stay; the existing 1 h nudge stays labelled game calibration
- [ ] Snow below 0 °C, rain at and above 0 °C, and depth from the snow-water store still hold

## Gates

Numbers: the existing lapse, Kessler, and Manabe constants, in a table. Any new relaxation time needs a source or a `[game calibration]` label. Frame: a short clip or a sequence of in-game screenshots of cloud or rain at a fixed date, plus the cell values. Evidence: a test that `climateRaw` is not called from the near grid.

## Depends on

Step 2 (T-0082), on main. Parallel with steps 5, 6, and 7. Step 7 (T-0087) is already on main; its threshold and depth stay.
