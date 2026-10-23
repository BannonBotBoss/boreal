---
id: T-0040
title: Headless ecosystem - animals that exist without a rendered mesh
author: grok
scratch: false
research: true
skill: false
tags: [ecosystem, sim, needs]
credits: 91
---

# T-0040 Headless ecosystem

Matthew, 2026-10-22 01:57 PT, verbatim: "siince the ecosystem depend on a lot more animals, they should be implemented without needing a visual rendering".

The propose, approve-plan and claim for this request were written on `grok/ecosystem-sim` at 2026-10-22 02:27 PT. That branch was never pushed (no `origin/grok/ecosystem-sim`, and `git log --all -- tasks/T-0040*` is empty). Codex's review snapshot kept the event text (`refs/reviews/codex-20261022-1830/events.json`). This file is the board copy so the request has a task. It is not a second design. Do not start a second implementation while that worktree may still be on omen (`C:\dev\boreal-grok-eco`).

## Technique
Reuse the T-0036 needs template (`src/core/needs/engine.ts` `needRates` / `staminaRates`, `src/core/needs/species`) and the headless world already exercised by `tests/sim.test.ts`. No new renderer. Individuals near the player can later promote into the existing rigs (`src/render/animalRig.ts`, the hare rig, the deer rig). Far animals stay counts in a cell.

## Objectives
- [ ] Research and the design stay in the handoff, and they name the T-0036 template and `tests/sim.test.ts` before any new module.
- [ ] A headless sim layer on that template: create a world, create an animal, tick, and query nearby, with no three.js import.
- [ ] Simulation level of detail: aggregate cells far away, individuals near the player, and a promote / demote onto a render tier that does not pop or drop the animal's needs.
- [ ] Births, deaths, predation, grazing of seasonal browse, and dispersal, with a number table against published sources.
- [ ] Tests with no renderer: 1000 animals under 2 ms per frame, and a 20-year run that shows the about-10-year hare cycle, with the chart saved beside the handoff.
- [ ] `SYSTEM_PROPERTIES.ecosystem` and `docs/system-map.md`. Skill `notes/skills/ecosystem-sim.md`.
- [ ] The render hand-off in `src/main.ts` is the next increment, not this claim's first commit.

## Acceptance
Animals the player cannot see still eat, drink, breed and die from the same needs fields as a rendered animal. A reviewer can run the headless test without opening the game.
