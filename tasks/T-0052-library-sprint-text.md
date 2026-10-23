---
id: T-0052
title: The library dialog matches the sprint and the systems that exist
author: grok
scratch: false
research: false
skill: false
tags: [ui, library, stamina]
credits: 30
---

# T-0052 The library dialog matches the sprint and the systems that exist

Suggested owner: whoever next claims the menu copy. Proposed by grok on the 2026-10-23 05:22 PT loop. Not claimed here: the author cannot approve-plan it.

The controls list is already the live bindings. The script-library dialog still describes a sprint timer that was removed, and it says two systems are missing that are in the game.

## What is wrong
`bindingTexts` (`src/main.ts` 328) writes `#help-binds`: "Shift then C sprints for 1.5 seconds" (and the same sentence for RT then LT). The static HTML in `index.html` says the same thing before that rewrite. `stepWolfModes` (`src/core/wolfModes.ts` 30) comments that the 1.5 s burst was removed: a sprint lasts until stamina is spent. Wolf `sprintSeconds` is 12 (`src/core/needs/species/index.ts` 24), from Matthew's 10 s minimum plus a 20% margin. `staminaRates` is `100 / sprintSeconds` (`src/core/needs/engine.ts` 51).

The same dialog says "collision, hunting, trading and construction are not implemented" (`index.html`). The catch path in `main.ts` posts "Caught a snowshoe hare!". Stone roll writes `rollX` / `rollZ` (`src/core/events.ts`). Trading and construction are still not systems.

The controls screen does not say 1.5 seconds. Its rows are the `ACTIONS` labels (`controls.png`).

Read from the open dialog on the preview (`tasks/evidence/2026-10-23-grok-loop-0522/capture.json` `dialog.info`, `library.png`): both sentences are in the live text.

## Numbers
| | game text | behaviour | holds |
| --- | --- | --- | --- |
| Sprint | "sprints for 1.5 seconds" | until stamina is spent; wolf `sprintSeconds` 12 | no |
| Hunting | "not implemented" | `main.ts` catch notice | no |
| Collision | "not implemented" | stone `rollX` / `rollZ` in `events.ts` | no |
| Trading, construction | "not implemented" | no system by those names | yes |

## Technique
Change the sentence in `bindingTexts`, and the matching static sentence in `index.html`, so it follows `stepWolfModes`: the sprint holds while stamina remains. Do not add a timer and do not change `sprintSeconds`. Delete or rewrite only the false half of the "not implemented" sentence (collision and hunting). Leave trading and construction as absent. Leave the controls screen labels as they are.

## Calibration
- Known match: the controls rows, which already omit "1.5 seconds" (`controls.png`).
- Known mismatch: the dialog text contains "1.5 seconds" and "collision, hunting, trading and construction are not implemented" (`library.png`).

Gate: the open dialog's text does not contain "1.5 seconds", and it does not say collision or hunting are unimplemented. A frame of that dialog is saved with the handoff.

## Objectives
- [ ] The live library text no longer says the sprint lasts 1.5 seconds. It says the sprint lasts until stamina is spent. `sprintSeconds` stays 12 for the wolf. `index.html` and `bindingTexts` agree.
- [ ] The dialog no longer says collision and hunting are not implemented. Trading and construction stay described as absent. The stone-roll sentence stays.
- [ ] A frame of the open library dialog showing the new sentences, saved with the handoff. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
Someone opening Library from Controls reads the sprint the wolf actually runs, and does not read that hunting and collision are missing.
