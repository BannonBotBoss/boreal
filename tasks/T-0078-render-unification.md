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

Matthew, 2026-10-25 7:15 PM PT: permission to rewrite anything, as long as design issues #100–#109 are addressed, especially #107. Where keeping an existing render path would compromise the single space-and-time observation pipeline, the plan replaces that path.

**Status: claimed.** grokbot-1 approve-plan, 2026-10-26 00:20 PT, covers the plan and phase 1 only. Phase 1 is the unread observation table. Later phases stay unbuilt. grokbot-3 does not approve its own plan.

**Credits: 52** (= 10 x 4 objectives x (1 + 0.3 research)). Matthew can change it.

## Plain-English summary

From space and from the forest, the game draws two different pictures.
Coming down, it fades between them, and the ground, the clouds, and the colours jump.
This plan makes one picture the whole way down.
What you see depends on how far away you are and on how fast time is moving.
Far away, or when time runs fast, a forest is a colour and a density on the land. Trees appear as you come close and as time slows down.
From space you see weather, the season, and how thick the plants are. Near a kilometre you see habitats. Near a hundred metres you see animals and trees. On the ground you see grass, tracks, and scents.
The change from one of these to the next is gradual, so nothing pops or flickers.
The extra sky, the extra clouds, and the fade between the two pictures go away.
An old way of drawing is replaced when keeping it would break this one picture.
Day and night stay. The picture still gets simpler when the computer struggles.
The flight down is one smooth picture. The work lands as several small steps, and each step can be tried on its own.

## Answers

Matthew, issues #107, #108, and #109 (2026-10-26). Newest issue wins where they disagree.

1. The flight down is one smooth picture.
2. Far away, forest is a colour and a density on the land. Trees appear close in. Height and the time dial choose the representation together (#107). #109 supplies the overlapping time levels, the hysteresis, and the blend.
3. Several small steps, each one testable.

## Goal

Inventory every drawing path with file and line evidence. Explain why they are separate and what that costs. Propose one drawing surface, one picture, one viewpoint, and one frame loop. Layer choice follows height and the time dial's observation rate together, with hysteresis and a blend so a boundary does not flicker. Map every existing system to keep, merge, or replace. A path that cannot serve that one pipeline is replaced. Phases stay small.

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

- The plan opens with the plain summary above, with the three answers recorded and no open decision left.
- Every drawing path in the inventory has a file and line, a renderer, a scene, a camera, a loop, a falloff, the shaders, and the data source.
- Isolation names the commits, pull requests, and tasks that created the split, and the costs (double draw, colour jump, two skies, two detail systems).
- The architecture reuses the forest renderer and loop, the planet distance tree, and the feature-size gate as the spatial score. Layer choice also reads the time dial. Each system is keep, merge, or replace, and the 7:15 PM PT permission is recorded.
- Issues #100–#109 are addressed. Where #107–#109 disagree with the older plan or with #100–#106, the newer issue is the one the phases follow.
- Phases name tests, the 60 fps budget, the frame gate, and the files they must not edit.
- The obvious first code step is the observation table, listed and not implemented.
- A propose event exists. There is no approve-plan from grokbot-3.

## Objectives

- [ ] Inventory every rendering path with file and line evidence (renderer, scene, camera, loop, falloff, shaders, data source)
- [ ] Explain why the paths are isolated and what that costs, with commits, pull requests, and tasks
- [ ] Propose one renderer, one scene, one camera, and one loop, with height and the time dial choosing the layers, and map every system to keep, merge, or replace
- [ ] Write the phased migration (tests, perf budgets, frame gates, risks) and list the first code step without implementing it
