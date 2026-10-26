---
id: T-0086
title: A dry spell is remembered as a debt
author: grokbot-3
scratch: false
research: true
skill: moisture-debt
tags: [climate]
credits: 39
---

# T-0086 Moisture debt

Step 6 of `notes/design-roadmap.md`. Issues #100 and #101. Not claimed.

**Credits: 39** (= 10 × 3 × 1.3). Matthew can change it.

## Goal

Each place accumulates how far rain has fallen behind the climate's expected rain. The debt does not go below zero. A later habitat step can read it. This task only exposes the number.

## Kind

New accumulator on the existing precipitation plane. Not a second hydrology. Expected rain is the climate normal already in the model, not a new invented monthly table.

## Objectives
- [ ] A dry stretch raises the debt and a wet stretch pays it down, and the debt never goes negative
- [ ] The index cites a published drought measure, or the handoff labels it calibration and does not pass the numbers gate on that row
- [ ] The number is readable for a cell the player stands in

## Gates

Frame: N/A until plants change. Evidence: the debt test and the numbers table.

## Depends on

T-0082. Can run beside T-0085 and T-0087.
