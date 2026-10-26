---
id: T-0078
title: One picture from space to the forest floor
author: grokbot-3
scratch: false
research: true
skill: render-path-audit
tags: [plan, render, globe]
credits: 52
---

# T-0078 One picture from space to the forest floor

Matthew, 2026-10-25 18:25 PT: "I am not satisfied with the implementation of the rendering system. Why are all these systems isolated? Everything should have been using the same set of pipelines. One system for rendering. Based on the distance, resolution is automatically scaled to show just the layers that produce a realistic view from that point." He also said never reinvent: reuse what already exists. 18:26 PT: the plan opens with a short plain summary.

**Status: proposed.** This pull request is the audit and the plan. It does not change the picture. Another agent, or Matthew, approve-plan before any phase is built. grokbot-3 does not approve its own plan.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## Plain-English summary

From space and from the forest, the game draws two different pictures.
Coming down, it fades between them, and the ground, the clouds, and the colours jump.
This plan makes one picture the whole way down.
High up you see the planet. Snow, forest colour, clouds, trees, grass, and water appear only when you are close enough to see them.
The extra sky, the extra clouds, and the fade between the two pictures go away.
Trees, grass, rivers, animals, and photos stay. They turn on by how high you are.
Day and night, and the setting that simplifies the picture when the computer struggles, stay the same.
Should the flight down be one smooth picture? Yes or no.
Far away, should forest be a colour on the land until trees are big enough to see (A), or simpler trees all the way up (B)?
Should this land as several small changes you can try one at a time (A), or one big change (B)?

## Goal

Inventory every drawing path with file and line evidence. Explain why they are separate and what that costs. Propose one drawing surface, one picture, one viewpoint, and one frame loop, with distance deciding which layers show. Map every existing system to keep, merge, or remove. Phases stay small.

## Why

The forest picture and the planet picture were built as two pages and then faded together. Later looks were added to whichever page was in progress. Matthew wants one system.

## Files

- `notes/render-unification-plan.md` (the audit and the plan)
- `notes/skills/render-path-audit.md`
- `tasks/handoffs/T-0078-grokbot-3.md`

## Size and risk

- Size: S (documents only)
- Risk: none for this pull request. Later phases name their own risks in the plan.

## Depends on

- Nothing for the audit.
- Phase 2 waits for `grokbot-3/globe-enter-fix` (`src/world/globe/inpage.ts`, `src/world/globe/globeView.ts`, the camera flight).
- Phase 3 waits for `grokbot-3/single-time-control` (the one clock). This task does not edit those files.

## What Matthew will see

The plan. The picture on screen does not change until a later phase is approved and built.

## Acceptance criteria

- The plan opens with the plain summary above.
- Every drawing path in the inventory has a file and line, a renderer, a scene, a camera, a loop, a falloff, the shaders, and the data source.
- Isolation names the commits, pull requests, and tasks that created the split, and the costs (double draw, colour jump, two skies, two detail systems).
- The architecture reuses the forest renderer and loop, the planet distance tree, and the feature-size gate. Each system is keep, merge, or remove.
- Phases name tests, the 60 fps budget, the frame gate, and the files they must not edit.
- The obvious first code step is listed and not implemented.
- A propose event exists. There is no approve-plan from grokbot-3.

## Objectives

- [ ] Inventory every rendering path with file and line evidence (renderer, scene, camera, loop, falloff, shaders, data source)
- [ ] Explain why the paths are isolated and what that costs, with commits, pull requests, and tasks
- [ ] Propose one renderer, one scene, one camera, and one loop, with distance-driven layers, and map every system to keep, merge, or remove
- [ ] Write the phased migration (tests, perf budgets, frame gates, risks) and list the first code step without implementing it
