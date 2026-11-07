---
id: T-0171
title: Decouple Senses HUD sight from scent hits, restore deer/person motion sight, and exclude non-visual scent deltas
status: proposed
author: agy
owner:
branch:
created: 2026-11-06T19:18:00-08:00
updated: 2026-11-06T19:18:00-08:00
scratch: false
research: true
skill: sense-pictures
tags: [senses, perception, ui]
credits: 39
---

## Problem

An audit of the Wolf senses HUD (`src/ui/senses.ts`, `createSensesHUD`) against the shared species perception model (`src/core/needs/senses.ts`, `perceive(WOLF_NEEDS, ...)`) and published canid visual-perception sources uncovered three real defects in how `sight` sense pictures (`.sense-bubble-sight`) are offered to `createSenseStream`:

1. **Sight pictures are gated on `smell()` scent hits (`lastHits`)**:
   - In `src/ui/senses.ts:64-71`, `offerLive` only calls `perceive(WOLF_NEEDS, ...)` inside `lastHits.forEach((h, i) => ...)`, where `lastHits = smell(nose, sources, wind, heading)` (`src/core/senses.ts:40-44`) filters by `scentLevel >= SENSES.threshold` (`0.025`) and caps at `SENSES.thoughtCap` (`3`).
   - When wind is calm (`<= 0.05 m/s`) or blowing from the wolf toward a target (`down <= 0`, wolf upwind of prey), local Gaussian scent diffusion (`potency * exp(-d^2 / 32) * (1 - d / 40)`) for a hare (`potency = 0.7`) drops below `0.025` at `d >= 9.87 m`.
   - Consequently, in `refs/senses/sight-audit/frame-0.png` (`d = 16.40 m`) and `refs/senses/sight-audit/frame-1.png` (hare `#2` actively fleeing at `d = 12.26 m` directly ahead in broad daylight, `wolfScentLevelOfHare = 0.00443 < 0.025`, `expectedSightStrength = 0.7957`), `lastHits` omits the hare and the Wolf senses HUD emits **0 sight bubbles** (`domSightBubbles = 0`), even though `WOLF_NEEDS.senses.sight` (`rangeM = 60 m`, `fovDeg = 250 deg`, Miller & Murphy 1995 *JAVMA* 207:1623; Mech 1970 *The Wolf*) gives a `0.7957` visual signal (`31.8x` above `SENSES.threshold = 0.025`).
   - Even downwind, if `3` nearby plants, logs, or scent marks (`potency = 0.3–1.0` at `1–4 m`) fill `lastHits` (`thoughtCap = 3`), any visible animal beyond `4 m` is excluded from `lastHits` and never evaluated for sight.

2. **Deer and visitor motion speed is hardcoded to `0` in `speedOf(key)`**:
   - `src/ui/senses.ts:32-36` defines:
     ```ts
     const speedOf = (key: string) => {
       if (!key.startsWith('hare:')) return 0;
       const id = Number(key.slice(5));
       return view.hares.list().find(h => h.id === id)?.sim.speed ?? 0;
     };
     ```
   - Because `WOLF_NEEDS.senses.sight.presenceM` is `6 m` while motion detection (`rangeM = 60 m`, `motion = [0.3, 1.5] m/s`) requires `speed > 0.3 m/s`, any walking or fleeing deer (`key` in `view.audibleAnimals()` / `view.lookup(key)?.brain?.speed`, `speed = 2.0–6.0 m/s`, expected `sight = 0.6667` at `20 m`) or walking visitor (`view.visitorOf(key)`, `speed = 1.2 m/s`, expected `sight = 0.50` at `20 m`) beyond `6 m` gets `speed = 0` and `seen.sight = 0` (`refs/senses/sight-audit/numbers.json`).

3. **Invisible scent deltas (`scent`, `droppings`) are passed to `perceive()` and emit false sight bubbles**:
   - `src/ui/senses.ts:102` appends `deltaSources(nose.x, nose.z, WOLF_AGENT.senses.scent.range)` (`kind: 'scent' | 'carcass' | 'droppings'`) into `sources` before `lastHits = smell(...)`.
   - When an invisible territory urine mark (`kind: 'scent'`) or scat deposit (`kind: 'droppings'`) is within `presenceM = 6 m` ahead of the wolf (`d = 2.0 m` in `refs/senses/sight-audit/frame-2.png`), `perceive()` computes `presence = 1 - 2.0 / 6.0 = 0.6667 >= 0.025` and offers `signalFromSight`, producing **4 false `.sense-bubble-sight` eye pictures** (`domSightBubbles = 4` vs expected `0` in `refs/senses/sight-audit/observations.json`) when no visible animal or object is in view.

## Evidence & Nature / Spec Table

Recorded in `refs/senses/sight-audit/recording.webm`, `refs/senses/sight-audit/frame-0.png`..`frame-2.png`, `refs/senses/sight-audit/observations.json` (`refs/senses/sight-audit/capture.mjs`), and calibrated numeric audit `refs/senses/sight-audit/numbers.json` (`refs/senses/sight-audit/numeric-check.mjs`):

| Metric / Parameter | Current Game Value (`src/ui/senses.ts`) | Expected / Published Source | Status |
|---|---|---|---|
| Wolf visual field (`WOLF_NEEDS.senses.sight.fovDeg`) & motion range (`rangeM`) | `250 deg` FOV, `60 m` motion range (`motion: [0.3, 1.5] m/s`), `6 m` still presence (`src/core/needs/species/index.ts:16`) | Canid binocular + peripheral FOV `~250 deg` and high peripheral motion sensitivity (Miller & Murphy 1995, *JAVMA* 207:1623-1634; Mech 1970, *The Wolf*, Univ. of Minnesota Press) | **Model matches nature, but HUD gates sight on `smell()`** |
| Fleeing hare (`state: "flee"`, `8.5 m/s`) at `12.26 m` ahead upwind (`frame-1.png`) | `wolfScentLevelOfHare = 0.00443 < 0.025` -> `domSightBubbles = 0` (`actualHudSightStrength = 0`) | `perceive(WOLF_NEEDS, ...).sight = 0.7957 >= 0.025` -> should emit `.sense-bubble-sight` | **Mismatch (`0` vs `0.7957`)** |
| Moving deer (`2.0 m/s`) at `20 m` ahead (`numbers.json` case 3) | `speedOf('deer:0') = 0` -> `actualHudSightStrength = 0` beyond `6 m` | `perceive(WOLF_NEEDS, ...).sight = 0.6667 >= 0.025` using real deer speed (`view.audibleAnimals()` / `view.lookup(key)?.brain?.speed`) | **Mismatch (`0` vs `0.6667`)** |
| Invisible `scent` mark delta `2.0 m` ahead (`frame-2.png`, `numbers.json` case 4) | `domSightBubbles = 4` (`actualHudSightStrength = 0.6667`) | `0` sight bubbles (territorial urine odor `kind: 'scent'` and `droppings` are olfactory traces in `deltaSources`, not visual bodies) | **Mismatch (`4` false sight bubbles vs `0`)** |

## Objectives

- [ ] Decouple sight signal evaluation in `src/ui/senses.ts` (`offerLive` / `createSensesHUD`) from `lastHits` (`smell()`) so visual bodies within `WOLF_NEEDS.senses.sight.rangeM` (`60 m`) are evaluated directly via `perceive(WOLF_NEEDS, { x: nose.x, z: nose.z, heading }, ...)` and the top `SENSES.thoughtCap` (`3`) visual hits with `seen.sight >= SENSES.threshold` are offered to `stream` regardless of wind direction or scent level.
- [ ] Extend `speedOf` (or visual body assembly) in `src/ui/senses.ts` so `deer` (`view.audibleAnimals()` / `view.lookup(key)?.brain?.speed`) and `person` (`view.visitorOf(key)?.speed` or motion state) pass their actual ground speed (m/s) to `perceive()` instead of `0`.
- [ ] Exclude non-visual olfactory trace deltas (`scent`, `droppings` from `deltaSources`) from visual sight evaluation so invisible scent marks never emit `.sense-bubble-sight` eye bubbles, and add unit tests covering upwind moving prey sight, moving deer/person sight beyond `presenceM` (`6 m`), and zero sight bubbles for `scent`/`droppings` deltas.
